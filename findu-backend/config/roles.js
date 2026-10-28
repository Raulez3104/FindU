const ROLES_ADMINISTRATIVOS = Object.freeze([
  'superadmin',
  'admin',
  'personal_servicios',
]);

function esRolAdministrativo(rol) {
  return ROLES_ADMINISTRATIVOS.includes(rol);
}

module.exports = { ROLES_ADMINISTRATIVOS, esRolAdministrativo };
