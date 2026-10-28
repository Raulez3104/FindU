import type { Sesion, Usuario } from '../types';

const ID_USUARIO_MAXIMO = 2147483647;

function esTextoNoVacio(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim().length > 0;
}

function esUsuario(valor: unknown): valor is Usuario {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }
  const usuario = valor as Record<string, unknown>;
  return (
    typeof usuario.id === 'number' &&
    Number.isSafeInteger(usuario.id) &&
    usuario.id >= 1 &&
    usuario.id <= ID_USUARIO_MAXIMO &&
    esTextoNoVacio(usuario.nombre) &&
    esTextoNoVacio(usuario.correo) &&
    (usuario.foto === null || typeof usuario.foto === 'string')
  );
}

export function esSesionVigente(valor: unknown, ahora: number = Date.now()): valor is Sesion {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }
  const sesion = valor as Record<string, unknown>;
  return (
    esTextoNoVacio(sesion.token) &&
    typeof sesion.expiraEn === 'number' &&
    Number.isSafeInteger(sesion.expiraEn) &&
    sesion.expiraEn > ahora &&
    esUsuario(sesion.usuario)
  );
}

export function parsearSesion(crudo: string | null, ahora: number = Date.now()): Sesion | null {
  if (!crudo) {
    return null;
  }
  try {
    const valor: unknown = JSON.parse(crudo);
    return esSesionVigente(valor, ahora) ? valor : null;
  } catch {
    return null;
  }
}
