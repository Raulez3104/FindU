const { ROLES_ADMINISTRATIVOS } = require('../config/roles');

const MENSAJE_OPERACION_NO_HABILITADA =
  'Operación administrativa no habilitada';

function crearAutorizadorPorRoles(rolesPermitidos = ROLES_ADMINISTRATIVOS) {
  const rolesAutorizados = new Set(rolesPermitidos);

  return function autorizarPorRol(req, res, next) {
    const rolActual = req.administrador && req.administrador.rol;
    if (!rolesAutorizados.has(rolActual)) {
      return res
        .status(403)
        .json({ message: MENSAJE_OPERACION_NO_HABILITADA });
    }

    return next();
  };
}

const autorizarLecturaAdministrativa = crearAutorizadorPorRoles();

module.exports = {
  autorizarLecturaAdministrativa,
  crearAutorizadorPorRoles,
};
