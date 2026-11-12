import type { JwtPayload } from 'jsonwebtoken';

export type RolAdministrativo =
  | 'superadmin'
  | 'admin'
  | 'personal_servicios';

export type TipoAutor = 'usuario' | 'admin';
export type TipoReporte = 'perdido' | 'encontrado';
export type EstadoReporte =
  | TipoReporte
  | 'en_servicios'
  | 'devuelto'
  | 'donado';
export type EstadoPresentado =
  | 'Perdido'
  | 'Encontrado'
  | 'En servicios'
  | 'Devuelto'
  | 'Donado';

export interface PerfilUsuario {
  readonly id: number;
  readonly nombre: string;
  readonly correo: string;
  readonly foto: string | null;
}

export interface PerfilAdministrador {
  readonly id: number;
  readonly nombre: string;
  readonly correo: string;
  readonly rol: RolAdministrativo;
}

export interface IdentidadInstitucional {
  readonly correo: string;
  readonly nombre: string;
  readonly foto: string | null;
}

export interface SesionJwt {
  readonly token: string;
  readonly expiraEn: number;
}

export interface SesionEstudiante extends SesionJwt {
  readonly usuario: PerfilUsuario;
}

export interface SesionAdministrativa extends SesionJwt {
  readonly administrador: PerfilAdministrador;
}

export interface ClaimsJwtEstudiante extends JwtPayload {
  readonly sub: string;
  readonly ambito: 'estudiante';
  readonly rol?: never;
}

export interface ClaimsJwtAdministrador extends JwtPayload {
  readonly sub: string;
  readonly ambito: 'administrador';
  readonly rol: RolAdministrativo;
}

export type ClaimsJwt = ClaimsJwtEstudiante | ClaimsJwtAdministrador;

export interface ConfiguracionJwt {
  readonly secret: string;
  readonly expiracionHoras: number;
  readonly emisor: 'FindU';
}

export interface ConfiguracionGoogle {
  readonly audiencias: readonly string[];
  readonly dominioInstitucional: string;
}

export interface ErrorConEstado extends Error {
  status: number;
}

export type FilaId = {
  readonly id: number;
};

export type FilaUsuario = {
  readonly id: number;
  readonly nombre: string;
  readonly correo: string;
  readonly foto: string | null;
  readonly activo: boolean;
};

export type FilaPerfilUsuario = FilaUsuario & {
  readonly fecha_creacion: string;
};

export type FilaAdministrador = {
  readonly id: number;
  readonly nombre: string;
  readonly correo: string;
  readonly rol: RolAdministrativo;
  readonly activo: boolean;
};

export type FilaAdministradorConContrasena = FilaAdministrador & {
  readonly contrasena: string;
};

export type FilaCategoria = {
  readonly id: number;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly icono: string | null;
};

export type FilaUbicacion = {
  readonly id: number;
  readonly nombre: string;
  readonly campus: string;
  readonly piso: number | null;
  readonly descripcion: string | null;
};

export type FilaUbicacionConActivo = FilaUbicacion & {
  readonly activo: boolean;
};

export type FilaReporte = {
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
  readonly activo: boolean | null;
};

export type ReportePresentado = Omit<FilaReporte, 'estado'> & {
  readonly estado: EstadoPresentado;
};

export interface ReporteConImagen extends ReportePresentado {
  readonly imageUrl: string | null;
}

export type FilaEstadoReporte = {
  readonly id: number;
  readonly tipo_reporte: TipoReporte;
  readonly estado: EstadoReporte;
};

export type ConteoPg = string | number | null;

export type FilaTotalesReportes = {
  readonly total: ConteoPg;
  readonly activos: ConteoPg;
  readonly inactivos: ConteoPg;
};

export type FilaConteoEstado = {
  readonly estado: EstadoReporte;
  readonly count: ConteoPg;
};

export type FilaSerieFecha = {
  readonly fecha: string | null;
  readonly count: ConteoPg;
};

export type FilaSerieUbicacion = {
  readonly campus: string | null;
  readonly ubicacion: string | null;
  readonly count: ConteoPg;
};

export interface EstadisticasReportes {
  total: number;
  activos: number;
  inactivos: number;
  porEstado: Record<EstadoPresentado, number>;
  seriesFechas: {
    fecha: string;
    count: number;
  }[];
  seriesUbicaciones: {
    campus: string;
    ubicacion: string;
    count: number;
  }[];
}

export interface DatosAltaReporte {
  readonly tipo_reporte?: unknown;
  readonly titulo?: unknown;
  readonly descripcion?: unknown;
  readonly contacto?: unknown;
  readonly categoria_id?: unknown;
  readonly fecha_incidente?: unknown;
  readonly campus?: unknown;
  readonly ubicacion_id?: unknown;
  readonly ubicacion_otro?: unknown;
  readonly estado?: unknown;
  readonly [clave: string]: unknown;
}

export type AutorReporte =
  | { readonly tipo: 'usuario'; readonly id: number }
  | { readonly tipo: 'admin'; readonly id: number };

export type FormaUbicacion =
  | {
      readonly campus: string;
      readonly forma: 'id';
      readonly ubicacion_id: number;
    }
  | {
      readonly campus: string;
      readonly forma: 'otro';
      readonly ubicacion_otro: string;
    };

export interface AltaReporteResuelta {
  readonly autor: AutorReporte;
  readonly titulo: string;
  readonly descripcion: string;
  readonly contacto: string;
  readonly categoria_id: number;
  readonly fecha_incidente: string;
  readonly campus: string;
  readonly ubicacion_id: number | null;
  readonly ubicacion_otro: string | null;
  readonly tipo_reporte: TipoReporte;
  readonly estado: EstadoReporte;
  readonly imagen: string;
}

export type VerificacionToken =
  | { readonly estado: 'ausente' }
  | { readonly estado: 'invalido' }
  | {
      readonly estado: 'valido';
      readonly payload: string | JwtPayload;
    };

export type OperacionAdministrativa =
  | 'alta'
  | 'recepcion'
  | 'devolucion'
  | 'cierre'
  | 'donacion'
  | 'edicion'
  | 'archivo'
  | 'reactivacion';

export interface VerificacionDevolucionA10 {
  readonly nombre_receptor: string;
  readonly referencia_comprobante: string;
  readonly observacion?: string;
  readonly usuario_id?: number;
}

export interface DatosEdicionReporte {
  readonly titulo?: string;
  readonly descripcion?: string;
  readonly contacto?: string;
  readonly categoria_id?: number;
  readonly fecha_incidente?: string;
  readonly campus?: string;
  readonly ubicacion_id?: number;
  readonly ubicacion_otro?: string;
}

export interface DiferenciaEdicion {
  readonly campo: string;
  readonly valor_anterior: string | null;
  readonly valor_nuevo: string | null;
}

export interface ResultadoMutacionReporte {
  readonly cambiado: boolean;
  readonly id: number;
  readonly estado?: EstadoPresentado;
  readonly activo?: boolean;
  readonly nota?: string;
}

export interface ResultadoEdicionReporte {
  readonly actualizado: boolean;
  readonly id: number;
}

export interface FilaTrazaHistorial {
  readonly id: number;
  readonly accion: string;
  readonly valor_anterior: string | null;
  readonly valor_nuevo: string | null;
  readonly realizado_por: number;
  readonly tipo_realizado_por: TipoAutor;
  readonly realizado_por_nombre: string;
  readonly fecha: string;
}

export interface SolicitudCierreReporte {
  readonly reporte_encontrado_id: number;
}

export interface EnlaceCierreExistente {
  readonly reporte_encontrado_id: number;
  readonly registro_devolucion_id?: number | null;
}

export interface ContraparteCierreValida {
  readonly reporte: FilaReporte;
  readonly entregaA10Id: number;
}

export interface CandidatoCierreReporte {
  readonly id: number;
  readonly titulo: string;
  readonly estado: EstadoPresentado;
  readonly fecha: string;
  readonly campus: string;
  readonly ubicacion: string | null;
  readonly archivado: boolean;
  readonly usado: boolean;
}

export interface DetalleEnlaceCierre {
  readonly reporte_encontrado_id: number;
  readonly entrega_original: VerificacionDevolucionA10 | null;
}

export interface RespuestaTrazaReporte {
  readonly historial: readonly FilaTrazaHistorial[];
  readonly verificacion_devolucion: VerificacionDevolucionA10 | null;
  readonly enlace_cierre?: DetalleEnlaceCierre | null;
  readonly nota_cierre_historico?: string | null;
}

export type DecisionOperacion =
  | {
      readonly tipo: 'mutacion';
      readonly cambios: Partial<FilaReporte>;
      readonly historial: readonly {
        readonly accion: string;
        readonly valor_anterior: string | null;
        readonly valor_nuevo: string | null;
      }[];
      readonly auditoria: {
        readonly accion: string;
        readonly detalles?: Record<string, unknown> | null;
      };
    }
  | {
      readonly tipo: 'sin_efecto';
      readonly respuesta:
        | { readonly cambiado: false; readonly id: number; readonly estado: EstadoPresentado; readonly nota?: string }
        | { readonly cambiado: false; readonly id: number; readonly activo: boolean }
        | { readonly actualizado: false; readonly id: number };
    }
  | {
      readonly tipo: 'error';
      readonly status: number;
      readonly message: string;
    };
