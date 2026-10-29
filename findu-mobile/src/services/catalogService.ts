import { api } from './api';

export interface Categoria {
  id: number;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
}

export interface Ubicacion {
  id: number;
  nombre: string;
  campus: string;
  piso: number | null;
  descripcion: string | null;
}

export async function obtenerCategorias(): Promise<Categoria[]> {
  const { data } = await api.get<Categoria[]>('/categorias');
  return data;
}

export async function obtenerUbicaciones(campus: string): Promise<Ubicacion[]> {
  const { data } = await api.get<Ubicacion[]>('/ubicaciones', {
    params: { campus },
  });
  return data;
}
