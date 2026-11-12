import type { CategoriaCatalogo, UbicacionCatalogo } from '../types/api';
import { clienteHttp } from './api';

export async function obtenerCategorias(): Promise<CategoriaCatalogo[]> {
  return clienteHttp.get<CategoriaCatalogo[]>('/categorias');
}

export async function obtenerUbicaciones(campus?: string): Promise<UbicacionCatalogo[]> {
  const ruta = campus && campus.trim() !== ''
    ? `/ubicaciones?campus=${encodeURIComponent(campus.trim())}`
    : '/ubicaciones';
  return clienteHttp.get<UbicacionCatalogo[]>(ruta);
}

export const servicioCatalogos = Object.freeze({
  obtenerCategorias,
  obtenerUbicaciones,
});

