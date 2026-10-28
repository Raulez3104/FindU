import type { EstadisticasReportes, Reporte } from '../types/api';
import { clienteHttp } from './api';
import { restaurarSesion } from './authService';

function resolverToken(tokenExplicito?: string | null): string {
  if (typeof tokenExplicito === 'string' && tokenExplicito.trim() !== '') {
    return tokenExplicito.trim();
  }
  const sesion = restaurarSesion(Date.now());
  if (!sesion || !sesion.token) {
    throw new Error('No hay una sesión administrativa activa');
  }
  return sesion.token;
}

export async function listarReportes(token?: string | null): Promise<Reporte[]> {
  const tokenResuelto = resolverToken(token);
  return clienteHttp.get<Reporte[]>('/administradores/reportes', tokenResuelto);
}

export async function obtenerEstadisticas(
  token?: string | null,
): Promise<EstadisticasReportes> {
  const tokenResuelto = resolverToken(token);
  return clienteHttp.get<EstadisticasReportes>(
    '/administradores/reportes/estadisticas',
    tokenResuelto,
  );
}

export async function obtenerReportePorId(
  id: number | string,
  token?: string | null,
): Promise<Reporte> {
  const tokenResuelto = resolverToken(token);
  return clienteHttp.get<Reporte>(
    `/administradores/reportes/${encodeURIComponent(String(id))}`,
    tokenResuelto,
  );
}

export const servicioReportes = Object.freeze({
  listarReportes,
  obtenerEstadisticas,
  obtenerReportePorId,
});
