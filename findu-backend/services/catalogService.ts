import pool = require('../config/database');
import type { FilaCategoria, FilaUbicacion } from '../types/modelos';

async function obtenerCategoriasActivas() {
  const resultado = await pool.query<FilaCategoria>(`
    SELECT id, nombre, descripcion, icono
    FROM categorias
    WHERE activo = TRUE
    ORDER BY LOWER(nombre)
  `);
  return resultado.rows;
}

async function obtenerUbicacionesActivas(campus: string | undefined) {
  const campusNormalizado = (campus || '').trim() || 'principal';
  const resultado = await pool.query<FilaUbicacion>(`
    SELECT id, nombre, campus, piso, descripcion
    FROM ubicaciones
    WHERE activo = TRUE AND campus = $1
    ORDER BY LOWER(campus), LOWER(nombre)
  `, [campusNormalizado]);
  return resultado.rows;
}

export { obtenerCategoriasActivas, obtenerUbicacionesActivas };
