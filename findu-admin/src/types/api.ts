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
  | 'Encontrado'
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
  readonly Encontrado?: number;
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

export interface CategoriaCatalogo {
  readonly id: number;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly icono: string | null;
}

export interface UbicacionCatalogo {
  readonly id: number;
  readonly nombre: string;
  readonly campus: string;
  readonly piso: string | null;
  readonly descripcion: string | null;
}

export interface DatosCrearReporteAdministrativo {
  readonly titulo: string;
  readonly descripcion: string;
  readonly contacto: string;
  readonly categoria_id: number;
  readonly fecha_incidente: string;
  readonly campus: string;
  readonly ubicacion_id?: number | null;
  readonly ubicacion_otro?: string | null;
  readonly image: File;
}

export interface RespuestaCrearReporte {
  readonly message: string;
  readonly id: number;
  readonly imagen: string;
  readonly imageUrl: string;
  readonly estado: 'En servicios';
}

export interface RespuestaRecepcionReporte {
  readonly message: string;
  readonly id: number;
  readonly estado: 'En servicios';
  readonly cambiado: boolean;
}

export interface VerificacionDevolucion {
  readonly nombre_receptor: string;
  readonly referencia_comprobante: string;
  readonly observacion?: string | null;
  readonly usuario_id?: number | null;
}

export interface EntradaTrazaHistorial {
  readonly id: number;
  readonly accion: string;
  readonly valor_anterior: string | null;
  readonly valor_nuevo: string | null;
  readonly realizado_por: number;
  readonly tipo_realizado_por: 'usuario' | 'admin';
  readonly fecha: string;
}

export interface DetalleEnlaceCierre {
  readonly reporte_encontrado_id: number;
  readonly entrega_original: VerificacionDevolucion | null;
}

export interface RespuestaTrazaReporte {
  readonly reporte_id: number;
  readonly historial: readonly EntradaTrazaHistorial[];
  readonly verificacion_devolucion: VerificacionDevolucion | null;
  readonly enlace_cierre?: DetalleEnlaceCierre | null;
  readonly nota_cierre_historico?: string | null;
}

export interface DatosDevolucionReporte {
  readonly nombre_receptor: string;
  readonly referencia_comprobante: string;
  readonly observacion?: string;
  readonly usuario_id?: number;
}

export interface CandidatoCierreReporte {
  readonly id: number;
  readonly titulo: string;
  readonly estado: 'Devuelto';
  readonly fecha: string;
  readonly campus: string;
  readonly ubicacion: string | null;
  readonly archivado: boolean;
  readonly usado: boolean;
}

export interface SolicitudCierreReporte {
  readonly reporte_encontrado_id: number;
}

export interface RespuestaDevolucionReporte {
  readonly message: string;
  readonly id: number;
  readonly estado: 'Devuelto';
  readonly cambiado: boolean;
}

export interface RespuestaCierreReporte {
  readonly message?: string;
  readonly id: number;
  readonly estado: 'Devuelto';
  readonly cambiado: boolean;
  readonly nota?: string;
}

export interface RespuestaDonacionReporte {
  readonly message: string;
  readonly id: number;
  readonly estado: 'Donado';
  readonly cambiado: boolean;
}

export interface DatosEdicionReporte {
  readonly titulo?: string;
  readonly descripcion?: string;
  readonly categoria_id?: number;
  readonly ubicacion_id?: number;
  readonly ubicacion_otro?: string;
  readonly fecha_incidente?: string;
  readonly campus?: string;
  readonly contacto?: string;
}

export interface RespuestaEdicionReporte {
  readonly message: string;
  readonly id: number;
  readonly actualizado: boolean;
}

export interface RespuestaArchivoReporte {
  readonly message: string;
  readonly id: number;
  readonly activo: false;
  readonly cambiado: boolean;
}

export interface RespuestaReactivacionReporte {
  readonly message: string;
  readonly id: number;
  readonly activo: true;
  readonly cambiado: boolean;
}
