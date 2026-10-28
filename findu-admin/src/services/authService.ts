import type {
  Administrador,
  RolAdministrativo,
  SesionAdministrativa,
  SolicitudLogin,
} from '../types/api';
import { clienteHttp } from './api';

export const CLAVE_SESION_STORAGE = 'findu_admin_sesion';
export const CLAVE_LEGACY_ADMIN = 'admin';

const ROLES_VALIDOS: ReadonlySet<RolAdministrativo> = new Set([
  'superadmin',
  'admin',
  'personal_servicios',
]);

function esRolValido(valor: unknown): valor is RolAdministrativo {
  return typeof valor === 'string' && ROLES_VALIDOS.has(valor as RolAdministrativo);
}

function esAdministradorValido(valor: unknown): valor is Administrador {
  if (!valor || typeof valor !== 'object') return false;
  const obj = valor as Record<string, unknown>;

  const idValido =
    typeof obj.id === 'number' &&
    Number.isInteger(obj.id) &&
    obj.id > 0 &&
    obj.id <= 2147483647;

  const nombreValido =
    typeof obj.nombre === 'string' && obj.nombre.trim().length > 0;

  const correoValido =
    typeof obj.correo === 'string' &&
    /^[^\s@]+@[^\s@]+$/.test(obj.correo.trim());

  return Boolean(idValido && nombreValido && correoValido && esRolValido(obj.rol));
}

export function validarSesion(
  sesion: unknown,
  ahora: number = Date.now(),
): SesionAdministrativa | null {
  if (!sesion || typeof sesion !== 'object') return null;
  const obj = sesion as Record<string, unknown>;

  if (typeof obj.token !== 'string' || obj.token.trim() === '') {
    return null;
  }

  if (
    typeof obj.expiraEn !== 'number' ||
    !Number.isFinite(obj.expiraEn) ||
    obj.expiraEn <= ahora
  ) {
    return null;
  }

  if (!esAdministradorValido(obj.administrador)) {
    return null;
  }

  return Object.freeze({
    token: obj.token.trim(),
    expiraEn: obj.expiraEn,
    administrador: Object.freeze({
      id: obj.administrador.id,
      nombre: obj.administrador.nombre.trim(),
      correo: obj.administrador.correo.trim(),
      rol: obj.administrador.rol,
    }),
  });
}

function limpiarAlmacenamientoLegacy(): void {
  try {
    localStorage.removeItem(CLAVE_LEGACY_ADMIN);
  } catch {
    // Si localStorage no está disponible en este entorno, ignorar
  }
}

export function guardarSesion(sesion: SesionAdministrativa): void {
  try {
    localStorage.setItem(CLAVE_SESION_STORAGE, JSON.stringify(sesion));
    limpiarAlmacenamientoLegacy();
  } catch {
    // Manejar entornos donde localStorage falle o esté deshabilitado
  }
}

export function cerrarSesion(): void {
  try {
    localStorage.removeItem(CLAVE_SESION_STORAGE);
    limpiarAlmacenamientoLegacy();
  } catch {
    // Ignorar fallas de borrado en storage
  }
}

export function restaurarSesion(ahora: number = Date.now()): SesionAdministrativa | null {
  limpiarAlmacenamientoLegacy();
  try {
    const raw = localStorage.getItem(CLAVE_SESION_STORAGE);
    if (!raw) {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      cerrarSesion();
      return null;
    }

    const sesionValidada = validarSesion(parsed, ahora);
    if (!sesionValidada) {
      cerrarSesion();
      return null;
    }

    return sesionValidada;
  } catch {
    return null;
  }
}

export async function login(credenciales: SolicitudLogin): Promise<SesionAdministrativa> {
  const correo = String(credenciales?.correo || '').trim();
  const contrasena = String(credenciales?.contrasena || '');

  const respuesta = await clienteHttp.post<SesionAdministrativa>(
    '/administradores/login',
    { correo, contrasena },
  );

  const sesionValidada = validarSesion(respuesta);
  if (!sesionValidada) {
    throw new Error('La respuesta de inicio de sesión no tiene un formato administrativo válido');
  }

  guardarSesion(sesionValidada);
  return sesionValidada;
}

export const servicioAutenticacion = Object.freeze({
  login,
  guardarSesion,
  restaurarSesion,
  cerrarSesion,
  validarSesion,
});
