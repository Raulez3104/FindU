import type { RolAdministrativo } from '../types/modelos';

const ROLES_ADMINISTRATIVOS: readonly RolAdministrativo[] = Object.freeze([
  'superadmin',
  'admin',
  'personal_servicios',
]);

function esRolAdministrativo(rol: unknown): rol is RolAdministrativo {
  return ROLES_ADMINISTRATIVOS.some((rolPermitido) => rolPermitido === rol);
}

export { ROLES_ADMINISTRATIVOS, esRolAdministrativo };
