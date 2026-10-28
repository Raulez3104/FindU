import { isAxiosError } from 'axios';
import { Platform } from 'react-native';
import { api } from './api';

export interface Reporte {
  id: number;
  usuario_id: number | null;
  administrador_id: number | null;
  tipo_autor: 'usuario' | 'admin';
  usuario_nombre: string | null;
  usuario_correo: string | null;
  administrador_nombre: string | null;
  titulo: string;
  descripcion: string;
  contacto: string;
  categoria_id: number;
  categoria_nombre: string;
  fecha_incidente: string;
  fecha: string;
  campus: string;
  ubicacion_id: number | null;
  ubicacion_nombre: string | null;
  ubicacion_otro: string | null;
  imagen: string | null;
  imageUrl: string | null;
  tipo_reporte: 'perdido' | 'encontrado';
  estado: string;
  activo: boolean;
}

export interface DatosAltaReporte {
  titulo: string;
  descripcion: string;
  contacto: string;
  tipo_reporte: 'perdido' | 'encontrado';
  categoria_id: number;
  fecha_incidente: string;
  campus: string;
  ubicacion_id?: number;
  ubicacion_otro?: string;
}

export interface ImagenReporte {
  uri: string;
  nombre: string;
  tipo: string;
}

export interface AltaReporteRespuesta {
  message: string;
  id: number;
  imagen: string | null;
  imageUrl: string | null;
}

export async function listarReportes(): Promise<Reporte[]> {
  const { data } = await api.get<Reporte[]>('/reportes');
  return data;
}

export async function obtenerReporte(id: number): Promise<Reporte> {
  const { data } = await api.get<Reporte>(`/reportes/${id}`);
  return data;
}

export async function obtenerReportesUsuario(usuarioId: number): Promise<Reporte[]> {
  const { data } = await api.get<{ reports: Reporte[] }>(`/reportes/usuario/${usuarioId}`);
  return data.reports;
}

export async function crearReporte(
  datos: DatosAltaReporte,
  imagen?: ImagenReporte
): Promise<AltaReporteRespuesta> {
  const formulario = new FormData();
  formulario.append('titulo', datos.titulo);
  formulario.append('descripcion', datos.descripcion);
  formulario.append('contacto', datos.contacto);
  formulario.append('tipo_reporte', datos.tipo_reporte);
  formulario.append('categoria_id', String(datos.categoria_id));
  formulario.append('fecha_incidente', datos.fecha_incidente);
  formulario.append('campus', datos.campus);

  if (datos.ubicacion_id !== undefined) {
    formulario.append('ubicacion_id', String(datos.ubicacion_id));
  }
  if (datos.ubicacion_otro !== undefined) {
    formulario.append('ubicacion_otro', datos.ubicacion_otro);
  }

  if (imagen) {
    if (Platform.OS === 'web') {
      const respuesta = await fetch(imagen.uri);
      const archivo = await respuesta.blob();
      formulario.append('image', archivo, imagen.nombre);
    } else {
      formulario.append('image', {
        uri: imagen.uri,
        name: imagen.nombre,
        type: imagen.tipo,
      } as unknown as Blob);
    }
  }

  // Axios fija application/x-www-form-urlencoded en POST cuando no hay
  // Content-Type. En Android, OkHttp usa ese valor como tipo del cuerpo
  // multipart y rechaza la petición. Dejamos que React Native añada el
  // boundary, pero solo en nativo: el navegador lo hace por su cuenta.
  const configuracion =
    Platform.OS === 'web' ? undefined : { headers: { 'Content-Type': 'multipart/form-data' } };

  const { data } = await api.post<AltaReporteRespuesta>('/reportes', formulario, configuracion);
  return data;
}

export function obtenerMensajeErrorReporte(error: unknown): string {
  if (isAxiosError(error)) {
    const respuesta = error.response?.data as { message?: unknown } | undefined;
    if (respuesta && typeof respuesta.message === 'string' && respuesta.message.trim()) {
      return respuesta.message;
    }
  }
  return 'No se pudo guardar el reporte. Intenta de nuevo.';
}

export function esReporteNoEncontrado(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 404;
}
