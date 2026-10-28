import axios, { AxiosError } from 'axios';
import { API_URL } from '../config/env';
import { borrarSesion } from './sessionStore';

declare module 'axios' {
  export interface AxiosRequestConfig {
    omitirAutorizacion?: boolean;
  }
}

let authToken: string | null = null;
let manejadorNoAutorizado: (() => void) | null = null;
let noAutorizadoNotificado = false;

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

export function setAuthToken(token: string | null): void {
  authToken = token;
  if (token) {
    noAutorizadoNotificado = false;
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  manejadorNoAutorizado = handler;
}

api.interceptors.request.use((config) => {
  if (authToken && !config.omitirAutorizacion) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (respuesta) => respuesta,
  async (error: AxiosError) => {
    const config = error.config;
    const fueAutenticada = !config?.omitirAutorizacion && Boolean(config?.headers?.Authorization);

    if (error.response?.status === 401 && fueAutenticada && !noAutorizadoNotificado) {
      noAutorizadoNotificado = true;
      try {
        await borrarSesion();
      } catch {
        // La sesión local se considera inválida aunque SecureStore falle.
      }
      manejadorNoAutorizado?.();
    }

    return Promise.reject(error);
  }
);

export default api;
