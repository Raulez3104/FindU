import type { ErrorRespuestaApi } from '../types/api';

export class ErrorApi extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ErrorApi';
    this.status = status;
  }

  get esNoAutenticado(): boolean {
    return this.status === 401;
  }

  get esNoAutorizado(): boolean {
    return this.status === 403;
  }

  get esNoEncontrado(): boolean {
    return this.status === 404;
  }

  get esPeticionInvalida(): boolean {
    return this.status === 400;
  }
}

export type Manejador401 = () => void;

let manejadorGlobal401: Manejador401 | null = null;

export function configurarManejador401(manejador: Manejador401 | null): void {
  manejadorGlobal401 = manejador;
}

export function obtenerManejador401(): Manejador401 | null {
  return manejadorGlobal401;
}

export function obtenerBaseUrl(): string {
  const variable = import.meta.env.VITE_API_URL;
  if (typeof variable === 'string' && variable.trim() !== '') {
    return variable.trim().replace(/\/+$/, '');
  }
  return '';
}

export interface OpcionesPeticion {
  readonly metodo?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  readonly token?: string | null;
  readonly cuerpo?: unknown;
  readonly cabeceras?: Record<string, string>;
}

export async function peticionHttp<T>(
  ruta: string,
  opciones: OpcionesPeticion = {},
): Promise<T> {
  const baseUrl = obtenerBaseUrl();
  const rutaNormalizada = ruta.startsWith('/') ? ruta : `/${ruta}`;
  const urlCompleta = `${baseUrl}${rutaNormalizada}`;

  const cabeceras: Record<string, string> = {
    Accept: 'application/json',
    ...(opciones.cabeceras || {}),
  };

  if (opciones.token && typeof opciones.token === 'string') {
    cabeceras.Authorization = `Bearer ${opciones.token.trim()}`;
  }

  let body: string | undefined;
  if (opciones.cuerpo !== undefined) {
    cabeceras['Content-Type'] = 'application/json';
    body = JSON.stringify(opciones.cuerpo);
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(urlCompleta, {
      method: opciones.metodo || 'GET',
      headers: cabeceras,
      body,
    });
  } catch {
    throw new ErrorApi(0, 'No fue posible conectar con el servidor');
  }

  if (respuesta.status === 401) {
    if (typeof manejadorGlobal401 === 'function') {
      try {
        manejadorGlobal401();
      } catch {
        // Prevenir que fallas en el callback interrumpan la propagación del error
      }
    }
  }

  if (!respuesta.ok) {
    let mensajeError = `Error HTTP ${respuesta.status}`;
    try {
      const datosError = (await respuesta.json()) as Partial<ErrorRespuestaApi>;
      if (typeof datosError?.message === 'string' && datosError.message.trim() !== '') {
        mensajeError = datosError.message.trim();
      }
    } catch {
      // Si la respuesta no es JSON, conservar el mensaje basado en status
    }
    throw new ErrorApi(respuesta.status, mensajeError);
  }

  try {
    return (await respuesta.json()) as T;
  } catch {
    throw new ErrorApi(
      respuesta.status,
      'La respuesta del servidor no tiene un formato válido',
    );
  }
}

export const clienteHttp = Object.freeze({
  get<T>(ruta: string, token?: string | null): Promise<T> {
    return peticionHttp<T>(ruta, { metodo: 'GET', token });
  },
  post<T>(ruta: string, cuerpo?: unknown, token?: string | null): Promise<T> {
    return peticionHttp<T>(ruta, { metodo: 'POST', cuerpo, token });
  },
});
