import type { NextFunction, Request, Response } from 'express';

import { ROLES_ADMINISTRATIVOS } from '../config/roles';
import type { OperacionAdministrativa, RolAdministrativo } from '../types/modelos';

const MENSAJE_OPERACION_NO_HABILITADA =
  'Operación administrativa no habilitada';

const ROLES_POR_OPERACION: Record<
  OperacionAdministrativa | 'lectura',
  readonly RolAdministrativo[]
> = Object.freeze({
  lectura: Object.freeze<RolAdministrativo[]>([
    'superadmin',
    'admin',
    'personal_servicios',
  ]),
  alta: Object.freeze<RolAdministrativo[]>([
    'admin',
    'personal_servicios',
  ]),
  recepcion: Object.freeze<RolAdministrativo[]>([
    'admin',
    'personal_servicios',
  ]),
  devolucion: Object.freeze<RolAdministrativo[]>([
    'admin',
    'personal_servicios',
  ]),
  cierre: Object.freeze<RolAdministrativo[]>([
    'admin',
    'personal_servicios',
  ]),
  donacion: Object.freeze<RolAdministrativo[]>(['admin']),
  edicion: Object.freeze<RolAdministrativo[]>([
    'admin',
    'personal_servicios',
  ]),
  archivo: Object.freeze<RolAdministrativo[]>([
    'admin',
    'personal_servicios',
  ]),
  reactivacion: Object.freeze<RolAdministrativo[]>([
    'admin',
    'personal_servicios',
  ]),
});

function esRolAutorizadoParaOperacion(
  operacion: OperacionAdministrativa | 'lectura',
  rol: unknown,
): boolean {
  if (typeof rol !== 'string') return false;
  const roles = ROLES_POR_OPERACION[operacion];
  return roles ? roles.includes(rol as RolAdministrativo) : false;
}

function crearAutorizadorPorRoles(
  rolesPermitidos: readonly RolAdministrativo[] = ROLES_ADMINISTRATIVOS,
) {
  const rolesAutorizados = new Set(rolesPermitidos);

  return function autorizarPorRol(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const rolActual = req.administrador && req.administrador.rol;
    if (rolActual === undefined || !rolesAutorizados.has(rolActual)) {
      return res
        .status(403)
        .json({ message: MENSAJE_OPERACION_NO_HABILITADA });
    }

    return next();
  };
}

function crearAutorizadorPorOperacion(
  operacion: OperacionAdministrativa | 'lectura',
) {
  const roles = ROLES_POR_OPERACION[operacion] ?? [];
  return crearAutorizadorPorRoles(roles);
}

const autorizarLecturaAdministrativa = crearAutorizadorPorOperacion('lectura');
const autorizarAltaReporte = crearAutorizadorPorOperacion('alta');
const autorizarRecepcionReporte = crearAutorizadorPorOperacion('recepcion');
const autorizarDevolucionReporte = crearAutorizadorPorOperacion('devolucion');
const autorizarCierreReporte = crearAutorizadorPorOperacion('cierre');
const autorizarDonacionReporte = crearAutorizadorPorOperacion('donacion');
const autorizarEdicionReporte = crearAutorizadorPorOperacion('edicion');
const autorizarArchivoReporte = crearAutorizadorPorOperacion('archivo');
const autorizarReactivacionReporte = crearAutorizadorPorOperacion('reactivacion');

export {
  ROLES_POR_OPERACION,
  esRolAutorizadoParaOperacion,
  crearAutorizadorPorRoles,
  crearAutorizadorPorOperacion,
  autorizarLecturaAdministrativa,
  autorizarAltaReporte,
  autorizarRecepcionReporte,
  autorizarDevolucionReporte,
  autorizarCierreReporte,
  autorizarDonacionReporte,
  autorizarEdicionReporte,
  autorizarArchivoReporte,
  autorizarReactivacionReporte,
};
