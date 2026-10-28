export type RolAdministrativo = 'superadmin' | 'admin' | 'personal_servicios';

export interface Administrador {
  readonly id: number;
  readonly nombre: string;
  readonly correo: string;
  readonly rol: RolAdministrativo;
}

export interface SesionAdministrativa {
  readonly token: string;
  readonly expiraEn: number;
  readonly administrador: Administrador;
}

export interface SolicitudLogin {
  readonly correo: string;
  readonly contrasena: string;
}

export type TipoReporte = 'perdido' | 'encontrado';

export type EstadoReporte =
  | 'Perdido'
  | 'En servicios'
  | 'Devuelto'
  | 'Donado';

export type TipoAutor = 'usuario' | 'admin';

export interface Reporte {
  readonly id: number;
  readonly usuario_id: number | null;
  readonly administrador_id: number | null;
  readonly tipo_autor: TipoAutor;
  readonly usuario_nombre: string | null;
  readonly usuario_correo: string | null;
  readonly administrador_nombre: string | null;
  readonly titulo: string;
  readonly descripcion: string;
  readonly contacto: string;
  readonly categoria_id: number;
  readonly categoria_nombre: string | null;
  readonly fecha_incidente: string;
  readonly fecha: string;
  readonly campus: string;
  readonly ubicacion_id: number | null;
  readonly ubicacion_nombre: string | null;
  readonly ubicacion_otro: string | null;
  readonly imagen: string | null;
  readonly tipo_reporte: TipoReporte;
  readonly estado: EstadoReporte;
  readonly activo: boolean;
}

export interface SerieFecha {
  readonly fecha: string;
  readonly count: number;
}

export interface SerieUbicacion {
  readonly campus: string;
  readonly ubicacion: string;
  readonly count: number;
}

export interface EstadisticasPorEstado {
  readonly Perdido?: number;
  readonly 'En servicios'?: number;
  readonly Devuelto?: number;
  readonly Donado?: number;
  readonly [estado: string]: number | undefined;
}

export interface EstadisticasReportes {
  readonly total: number;
  readonly activos: number;
  readonly inactivos: number;
  readonly porEstado: EstadisticasPorEstado;
  readonly seriesFechas: readonly SerieFecha[];
  readonly seriesUbicaciones: readonly SerieUbicacion[];
}

export interface ErrorRespuestaApi {
  readonly message: string;
}
