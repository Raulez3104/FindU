import type { Sesion, Usuario } from '../types';
import { api } from './api';

export interface UsuarioPerfil extends Usuario {
  activo: boolean;
  fecha_creacion: string;
}

export async function iniciarSesionGoogle(idToken: string): Promise<Sesion> {
  const { data } = await api.post<Sesion>(
    '/usuarios/iniciar-sesion-google',
    { idToken },
    { omitirAutorizacion: true }
  );
  return data;
}

export async function obtenerPerfil(usuarioId: number): Promise<UsuarioPerfil> {
  const { data } = await api.get<{ usuario: UsuarioPerfil }>(`/usuarios/${usuarioId}`);
  return data.usuario;
}
