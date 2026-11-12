import type {
  CandidatoCierreReporte,
  DatosCrearReporteAdministrativo,
  DatosDevolucionReporte,
  DatosEdicionReporte,
  EstadisticasReportes,
  Reporte,
  RespuestaArchivoReporte,
  RespuestaCierreReporte,
  RespuestaCrearReporte,
  RespuestaDevolucionReporte,
  RespuestaDonacionReporte,
  RespuestaEdicionReporte,
  RespuestaReactivacionReporte,
  RespuestaRecepcionReporte,
  RespuestaTrazaReporte,
  SolicitudCierreReporte,
} from '../types/api';
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

export async function crearReporteAdministrativo(
  datos: DatosCrearReporteAdministrativo | FormData,
  token?: string | null,
): Promise<RespuestaCrearReporte> {
  const tokenResuelto = resolverToken(token);
  let formData: FormData;

  if (datos instanceof FormData) {
    formData = datos;
  } else {
    formData = new FormData();
    formData.append('titulo', datos.titulo);
    formData.append('descripcion', datos.descripcion);
    formData.append('contacto', datos.contacto);
    formData.append('categoria_id', String(datos.categoria_id));
    formData.append('fecha_incidente', datos.fecha_incidente);
    formData.append('campus', datos.campus);
    formData.append('tipo_reporte', 'encontrado');
    if (datos.ubicacion_id !== undefined && datos.ubicacion_id !== null) {
      formData.append('ubicacion_id', String(datos.ubicacion_id));
    }
    if (
      typeof datos.ubicacion_otro === 'string' &&
      datos.ubicacion_otro.trim() !== ''
    ) {
      formData.append('ubicacion_otro', datos.ubicacion_otro.trim());
    }
    formData.append('image', datos.image);
  }

  return clienteHttp.postMultipart<RespuestaCrearReporte>(
    '/administradores/reportes',
    formData,
    tokenResuelto,
  );
}

export async function recepcionarReporte(
  id: number | string,
  token?: string | null,
): Promise<RespuestaRecepcionReporte> {
  const tokenResuelto = resolverToken(token);
  return clienteHttp.post<RespuestaRecepcionReporte>(
    `/administradores/reportes/${encodeURIComponent(String(id))}/recepcion`,
    {},
    tokenResuelto,
  );
}

export async function obtenerTrazaReporte(
  id: number | string,
  token?: string | null,
): Promise<RespuestaTrazaReporte> {
  const tokenResuelto = resolverToken(token);
  return clienteHttp.get<RespuestaTrazaReporte>(
    `/administradores/reportes/${encodeURIComponent(String(id))}/historial`,
    tokenResuelto,
  );
}

export async function devolverReporte(
  id: number | string,
  datos: DatosDevolucionReporte,
  token?: string | null,
): Promise<RespuestaDevolucionReporte> {
  const tokenResuelto = resolverToken(token);
  return clienteHttp.post<RespuestaDevolucionReporte>(
    `/administradores/reportes/${encodeURIComponent(String(id))}/devolucion`,
    datos,
    tokenResuelto,
  );
}

export async function obtenerCandidatosCierre(
  id: number | string,
  busqueda?: string,
  token?: string | null,
): Promise<readonly CandidatoCierreReporte[]> {
  const tokenResuelto = resolverToken(token);
  const params = busqueda && busqueda.trim() !== ''
    ? `?busqueda=${encodeURIComponent(busqueda.trim())}`
    : '';
  return clienteHttp.get<readonly CandidatoCierreReporte[]>(
    `/administradores/reportes/${encodeURIComponent(String(id))}/candidatos-cierre${params}`,
    tokenResuelto,
  );
}

export async function cerrarReportePerdido(
  id: number | string,
  datos: SolicitudCierreReporte,
  token?: string | null,
): Promise<RespuestaCierreReporte> {
  const tokenResuelto = resolverToken(token);
  return clienteHttp.post<RespuestaCierreReporte>(
    `/administradores/reportes/${encodeURIComponent(String(id))}/cierre`,
    datos,
    tokenResuelto,
  );
}

export async function donarReporte(
  id: number | string,
  token?: string | null,
): Promise<RespuestaDonacionReporte> {
  const tokenResuelto = resolverToken(token);
  return clienteHttp.post<RespuestaDonacionReporte>(
    `/administradores/reportes/${encodeURIComponent(String(id))}/donacion`,
    {},
    tokenResuelto,
  );
}

export async function editarReporte(
  id: number | string,
  datos: DatosEdicionReporte,
  token?: string | null,
): Promise<RespuestaEdicionReporte> {
  const tokenResuelto = resolverToken(token);
  return clienteHttp.patch<RespuestaEdicionReporte>(
    `/administradores/reportes/${encodeURIComponent(String(id))}`,
    datos,
    tokenResuelto,
  );
}

export async function archivarReporte(
  id: number | string,
  token?: string | null,
): Promise<RespuestaArchivoReporte> {
  const tokenResuelto = resolverToken(token);
  return clienteHttp.post<RespuestaArchivoReporte>(
    `/administradores/reportes/${encodeURIComponent(String(id))}/archivo`,
    {},
    tokenResuelto,
  );
}

export async function reactivarReporte(
  id: number | string,
  token?: string | null,
): Promise<RespuestaReactivacionReporte> {
  const tokenResuelto = resolverToken(token);
  return clienteHttp.post<RespuestaReactivacionReporte>(
    `/administradores/reportes/${encodeURIComponent(String(id))}/reactivacion`,
    {},
    tokenResuelto,
  );
}

export const servicioReportes = Object.freeze({
  listarReportes,
  obtenerEstadisticas,
  obtenerReportePorId,
  crearReporteAdministrativo,
  recepcionarReporte,
  devolverReporte,
  cerrarReportePerdido,
  donarReporte,
  editarReporte,
  archivarReporte,
  reactivarReporte,
  obtenerTrazaReporte,
});
