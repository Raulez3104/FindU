import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload, VerifyOptions } from 'jsonwebtoken';

import { ALGORITMO_JWT, cargarConfiguracionJwt } from '../config/jwt';
import type {
  ConfiguracionJwt,
  FilaAdministrador,
  FilaUsuario,
  PerfilAdministrador,
  VerificacionToken,
} from '../types/modelos';

interface ServicioAdministradores {
  obtenerPorId(id: number): Promise<FilaAdministrador | null>;
  construirPerfilAdministrativo(
    administrador: FilaAdministrador,
  ): PerfilAdministrador;
}

interface ServicioUsuarios {
  obtenerPorId(id: number): Promise<FilaUsuario[]>;
}

type ObtenerConfiguracionJwt = () => Readonly<ConfiguracionJwt>;
type VerificarJwt = (
  token: string,
  secret: string,
  opciones: VerifyOptions,
) => string | JwtPayload;
type ObtenerUsuarioPorId = (id: number) => Promise<FilaUsuario | null>;
type ObtenerAdministradorPorId = (
  id: number,
) => Promise<FilaAdministrador | null>;

interface DependenciasVerificacion {
  obtenerConfiguracionJwt?: ObtenerConfiguracionJwt;
  verificarJwt?: VerificarJwt;
}

interface DependenciasAutenticador extends DependenciasVerificacion {
  obtenerUsuarioPorId?: ObtenerUsuarioPorId;
}

interface DependenciasAutenticadorAdministrativo
  extends DependenciasVerificacion {
  obtenerAdministradorPorId?: ObtenerAdministradorPorId;
}

const adminService: ServicioAdministradores = require('../services/adminService');
const userService: ServicioUsuarios = require('../services/userService');

const ID_MAXIMO = 2147483647;
const MENSAJE_AUTENTICACION_REQUERIDA = 'Autenticación requerida';
const MENSAJE_SESION_INVALIDA = 'Sesión inválida o expirada';
const MENSAJE_OPERACION_NO_HABILITADA =
  'Operación administrativa no habilitada';

function contarCabecerasAutorizacion(req: Request) {
  if (!Array.isArray(req.rawHeaders)) return 1;

  let cantidad = 0;
  for (let indice = 0; indice < req.rawHeaders.length; indice += 2) {
    if (String(req.rawHeaders[indice]).toLowerCase() === 'authorization') {
      cantidad += 1;
    }
  }
  return cantidad;
}

function extraerTokenBearer(req: Request) {
  const cabecera = req.headers.authorization;
  if (
    contarCabecerasAutorizacion(req) !== 1 ||
    typeof cabecera !== 'string'
  ) {
    return null;
  }

  const coincidencia = /^Bearer ([^\s,]+)$/.exec(cabecera);
  return coincidencia ? coincidencia[1] : null;
}

function convertirSubAId(sub: unknown) {
  if (typeof sub === 'number') {
    return Number.isInteger(sub) && sub >= 1 && sub <= ID_MAXIMO
      ? sub
      : null;
  }

  if (typeof sub !== 'string' || !/^[1-9]\d*$/.test(sub)) {
    return null;
  }

  const id = Number(sub);
  return Number.isSafeInteger(id) && id <= ID_MAXIMO ? id : null;
}

function verificarTokenDeSolicitud(
  req: Request,
  {
    obtenerConfiguracionJwt = cargarConfiguracionJwt,
    verificarJwt = jwt.verify,
  }: DependenciasVerificacion = {},
): VerificacionToken {
  const token = extraerTokenBearer(req);
  if (!token) return Object.freeze({ estado: 'ausente' });

  const configuracion = obtenerConfiguracionJwt();
  try {
    return Object.freeze({
      estado: 'valido',
      payload: verificarJwt(token, configuracion.secret, {
        algorithms: [ALGORITMO_JWT],
        issuer: configuracion.emisor,
      }),
    });
  } catch (_errorJwt: unknown) {
    return Object.freeze({ estado: 'invalido' });
  }
}

async function obtenerUsuarioActivoPorId(id: number) {
  const filas = await userService.obtenerPorId(id);
  return filas[0] || null;
}

function crearAutenticador({
  obtenerConfiguracionJwt = cargarConfiguracionJwt,
  obtenerUsuarioPorId = obtenerUsuarioActivoPorId,
  verificarJwt = jwt.verify,
}: DependenciasAutenticador = {}) {
  return async function autenticar(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const verificacion = verificarTokenDeSolicitud(req, {
      obtenerConfiguracionJwt,
      verificarJwt,
    });
    if (verificacion.estado === 'ausente') {
      return res
        .status(401)
        .json({ message: MENSAJE_AUTENTICACION_REQUERIDA });
    }
    if (verificacion.estado === 'invalido') {
      return res.status(401).json({ message: MENSAJE_SESION_INVALIDA });
    }

    const { payload } = verificacion;
    if (typeof payload !== 'object' || payload === null) {
      return res.status(401).json({ message: MENSAJE_SESION_INVALIDA });
    }
    const claims: Record<string, unknown> = payload;
    const usuarioId = convertirSubAId(claims.sub);
    if (usuarioId === null || claims.ambito !== 'estudiante') {
      return res.status(401).json({ message: MENSAJE_SESION_INVALIDA });
    }

    let usuario: FilaUsuario | null;
    try {
      usuario = await obtenerUsuarioPorId(usuarioId);
    } catch (error: unknown) {
      return next(error);
    }

    if (!usuario || usuario.activo !== true) {
      return res.status(401).json({ message: MENSAJE_SESION_INVALIDA });
    }

    req.usuario = Object.freeze({
      id: usuario.id,
      nombre: usuario.nombre,
      correo: usuario.correo,
      foto: usuario.foto || null,
    });
    return next();
  };
}

function crearAutenticadorAdministrativo({
  obtenerConfiguracionJwt = cargarConfiguracionJwt,
  obtenerAdministradorPorId = adminService.obtenerPorId,
  verificarJwt = jwt.verify,
}: DependenciasAutenticadorAdministrativo = {}) {
  return async function autenticarAdministrador(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const verificacion = verificarTokenDeSolicitud(req, {
      obtenerConfiguracionJwt,
      verificarJwt,
    });
    if (verificacion.estado === 'ausente') {
      return res
        .status(401)
        .json({ message: MENSAJE_AUTENTICACION_REQUERIDA });
    }
    if (verificacion.estado === 'invalido') {
      return res.status(401).json({ message: MENSAJE_SESION_INVALIDA });
    }

    const { payload } = verificacion;
    if (typeof payload === 'object' && payload !== null) {
      const claims: Record<string, unknown> = payload;
      if (claims.ambito === 'estudiante') {
        return res
          .status(403)
          .json({ message: MENSAJE_OPERACION_NO_HABILITADA });
      }
    }

    const claims: Record<string, unknown> =
      typeof payload === 'object' && payload !== null ? payload : {};
    const administradorId = convertirSubAId(claims.sub);
    if (
      administradorId === null ||
      claims.ambito !== 'administrador'
    ) {
      return res.status(401).json({ message: MENSAJE_SESION_INVALIDA });
    }

    let administrador: FilaAdministrador | null;
    try {
      administrador = await obtenerAdministradorPorId(administradorId);
    } catch (error: unknown) {
      return next(error);
    }

    if (!administrador || administrador.activo !== true) {
      return res.status(401).json({ message: MENSAJE_SESION_INVALIDA });
    }

    req.administrador = adminService.construirPerfilAdministrativo(
      administrador,
    );
    return next();
  };
}

function bloquearRutaNoEstudiantil(_req: Request, res: Response) {
  return res.status(403).json({ message: MENSAJE_OPERACION_NO_HABILITADA });
}

const autenticar = crearAutenticador();
const autenticarAdministrador = crearAutenticadorAdministrativo();

export {
  autenticar,
  autenticarAdministrador,
  bloquearRutaNoEstudiantil,
  convertirSubAId,
  crearAutenticador,
  crearAutenticadorAdministrativo,
  extraerTokenBearer,
  verificarTokenDeSolicitud,
};
