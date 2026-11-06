import type { NextFunction, Request, Response } from 'express';

import { ROLES_ADMINISTRATIVOS } from '../config/roles';
import type { RolAdministrativo } from '../types/modelos';

const MENSAJE_OPERACION_NO_HABILITADA =
  'Operación administrativa no habilitada';

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

const autorizarLecturaAdministrativa = crearAutorizadorPorRoles();

export { autorizarLecturaAdministrativa, crearAutorizadorPorRoles };
