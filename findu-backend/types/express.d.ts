import type { PerfilAdministrador, PerfilUsuario } from './modelos';

declare global {
  namespace Express {
    interface Request {
      usuario?: PerfilUsuario;
      administrador?: PerfilAdministrador;
    }
  }

  interface Error {
    status?: number;
  }
}

export {};
