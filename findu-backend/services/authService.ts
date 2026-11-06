import { OAuth2Client } from 'google-auth-library';
import type { TokenPayload } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import type { Secret, SignOptions } from 'jsonwebtoken';

import { cargarConfiguracionGoogle } from '../config/google';
import { ALGORITMO_JWT, cargarConfiguracionJwt } from '../config/jwt';
import { resolverCuentaEstudiantil } from './userService';
import type {
  ConfiguracionGoogle,
  ConfiguracionJwt,
  FilaUsuario,
  IdentidadInstitucional,
  PerfilAdministrador,
  PerfilUsuario,
  RolAdministrativo,
  SesionEstudiante,
  SesionJwt,
} from '../types/modelos';

type Reloj = () => number;
type FirmarJwt = (
  payload: object,
  secret: Secret,
  options: SignOptions,
) => string;
type ResolverCuentaEstudiantil = (
  identidad: IdentidadInstitucional,
) => Promise<FilaUsuario>;
type ObtenerConfiguracionGoogle = () => Readonly<ConfiguracionGoogle>;
type ObtenerConfiguracionJwt = () => Readonly<ConfiguracionJwt>;

type ClienteGoogle = Pick<OAuth2Client, 'verifyIdToken'>;

interface OpcionesTokenJwt {
  readonly ambito: 'estudiante' | 'administrador';
  readonly rol?: RolAdministrativo;
  readonly configuracion: Readonly<ConfiguracionJwt>;
  readonly reloj?: Reloj;
  readonly firmar?: FirmarJwt;
}

interface OpcionesSesionJwt {
  readonly configuracion: Readonly<ConfiguracionJwt>;
  readonly reloj?: Reloj;
  readonly firmar?: FirmarJwt;
}

interface DependenciasAutenticacion<T> {
  readonly clienteGoogle?: ClienteGoogle;
  readonly obtenerConfiguracionGoogle?: ObtenerConfiguracionGoogle;
  readonly resolverCuentaEstudiantil?: ResolverCuentaEstudiantil;
  readonly obtenerConfiguracionJwt?: ObtenerConfiguracionJwt;
  readonly reloj?: Reloj;
  readonly firmarJwt?: FirmarJwt;
  readonly continuarAutenticacion?: (
    identidad: IdentidadInstitucional,
  ) => Promise<T>;
}

interface ServicioAutenticacion<T> {
  autenticarConGoogle(idToken: unknown): Promise<T>;
}

const MENSAJE_IDENTIDAD_INVALIDA =
  'No fue posible verificar la identidad institucional';

const firmarJwtPredeterminado: FirmarJwt = (payload, secret, options) =>
  jwt.sign(payload, secret, options);

function crearErrorAutenticacion() {
  return Object.assign(new Error(MENSAJE_IDENTIDAD_INVALIDA), { status: 401 });
}

function normalizarCorreo(correo: unknown) {
  return typeof correo === 'string' ? correo.trim().toLowerCase() : '';
}

function perteneceAlDominioInstitucional(
  correo: unknown,
  dominioInstitucional: unknown,
) {
  const correoNormalizado = normalizarCorreo(correo);
  const dominioNormalizado = String(dominioInstitucional || '')
    .trim()
    .toLowerCase();

  if (!/^[^\s@]+@[^\s@]+$/.test(correoNormalizado)) {
    return false;
  }

  const dominioCorreo = correoNormalizado.slice(
    correoNormalizado.lastIndexOf('@') + 1,
  );
  return dominioCorreo === dominioNormalizado;
}

function validarClaimsGoogle(
  claims: TokenPayload | null | undefined,
  dominioInstitucional: string,
): Readonly<IdentidadInstitucional> {
  if (!claims || claims.email_verified !== true) {
    throw crearErrorAutenticacion();
  }

  const correo = normalizarCorreo(claims.email);
  if (!perteneceAlDominioInstitucional(correo, dominioInstitucional)) {
    throw crearErrorAutenticacion();
  }

  const nombre = typeof claims.name === 'string' ? claims.name.trim() : '';
  if (!nombre) {
    throw crearErrorAutenticacion();
  }

  const foto =
    typeof claims.picture === 'string' && claims.picture.trim()
      ? claims.picture.trim()
      : null;

  return Object.freeze({ correo, nombre, foto });
}

function construirPerfil(usuario: FilaUsuario): Readonly<PerfilUsuario> {
  return Object.freeze({
    id: usuario.id,
    nombre: usuario.nombre,
    correo: usuario.correo,
    foto: usuario.foto || null,
  });
}

function emitirTokenJwt(
  sujeto: Pick<PerfilUsuario | PerfilAdministrador, 'id'>,
  {
    ambito,
    rol,
    configuracion,
    reloj = Date.now,
    firmar = firmarJwtPredeterminado,
  }: OpcionesTokenJwt,
): Readonly<SesionJwt> {
  const emitidoEn = Math.floor(reloj() / 1000);
  const expiraEnSegundos =
    emitidoEn + configuracion.expiracionHoras * 60 * 60;
  const token = firmar(
    {
      sub: String(sujeto.id),
      ambito,
      ...(rol === undefined ? {} : { rol }),
      iat: emitidoEn,
      exp: expiraEnSegundos,
    },
    configuracion.secret,
    {
      algorithm: ALGORITMO_JWT,
      issuer: configuracion.emisor,
    },
  );

  return Object.freeze({
    token,
    expiraEn: expiraEnSegundos * 1000,
  });
}

function emitirSesionJwt(
  usuario: FilaUsuario,
  {
    configuracion,
    reloj = Date.now,
    firmar = firmarJwtPredeterminado,
  }: OpcionesSesionJwt,
): Readonly<SesionEstudiante> {
  return Object.freeze({
    ...emitirTokenJwt(usuario, {
      ambito: 'estudiante',
      configuracion,
      reloj,
      firmar,
    }),
    usuario: construirPerfil(usuario),
  });
}

function emitirSesionAdministrativaJwt(
  administrador: PerfilAdministrador,
  {
    configuracion,
    reloj = Date.now,
    firmar = firmarJwtPredeterminado,
  }: OpcionesSesionJwt,
): Readonly<SesionJwt> {
  return emitirTokenJwt(administrador, {
    ambito: 'administrador',
    rol: administrador.rol,
    configuracion,
    reloj,
    firmar,
  });
}

function crearServicioAutenticacion(
  dependencias?: Omit<DependenciasAutenticacion<SesionEstudiante>, 'continuarAutenticacion'>,
): ServicioAutenticacion<SesionEstudiante>;
function crearServicioAutenticacion<T>(
  dependencias: DependenciasAutenticacion<T> & {
    readonly continuarAutenticacion: (
      identidad: IdentidadInstitucional,
    ) => Promise<T>;
  },
): ServicioAutenticacion<T>;
function crearServicioAutenticacion<T = SesionEstudiante>({
  clienteGoogle = new OAuth2Client(),
  obtenerConfiguracionGoogle = cargarConfiguracionGoogle,
  resolverCuentaEstudiantil: resolverCuenta = resolverCuentaEstudiantil,
  obtenerConfiguracionJwt = cargarConfiguracionJwt,
  reloj = Date.now,
  firmarJwt = firmarJwtPredeterminado,
  continuarAutenticacion,
}: DependenciasAutenticacion<T> = {}): ServicioAutenticacion<T | SesionEstudiante> {
  const completarAutenticacion =
    continuarAutenticacion ||
    (async (identidad: IdentidadInstitucional) => {
      const usuario = await resolverCuenta(identidad);
      return emitirSesionJwt(usuario, {
        configuracion: obtenerConfiguracionJwt(),
        reloj,
        firmar: firmarJwt,
      });
    });

  async function autenticarConGoogle(idToken: unknown) {
    if (typeof idToken !== 'string' || idToken.trim() === '') {
      throw crearErrorAutenticacion();
    }

    const configuracion = obtenerConfiguracionGoogle();
    let claims: TokenPayload | undefined;

    try {
      const ticket = await clienteGoogle.verifyIdToken({
        idToken,
        audience: configuracion.audiencias as string[],
      });
      claims = ticket.getPayload();
    } catch (_errorGoogle: unknown) {
      throw crearErrorAutenticacion();
    }

    const identidad = validarClaimsGoogle(
      claims,
      configuracion.dominioInstitucional,
    );
    return completarAutenticacion(identidad);
  }

  return Object.freeze({ autenticarConGoogle });
}

const servicioAutenticacion = crearServicioAutenticacion();

export {
  crearServicioAutenticacion,
  construirPerfil,
  emitirSesionAdministrativaJwt,
  emitirSesionJwt,
  normalizarCorreo,
  perteneceAlDominioInstitucional,
  validarClaimsGoogle,
};

export const autenticarConGoogle = servicioAutenticacion.autenticarConGoogle;
