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
