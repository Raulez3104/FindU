import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { setAuthToken, setUnauthorizedHandler } from '../services/api';
import { borrarSesion, guardarSesion, leerSesion } from '../services/sessionStore';
import type { Sesion, Usuario } from '../types';
import { esSesionVigente } from '../utils/session';

interface AuthContextType {
  user: Usuario | null;
  login: (sesion: Sesion) => Promise<void>;
  logout: () => Promise<void>;
  mensajeSesion: string | null;
  limpiarMensajeSesion: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [loading, setLoading] = useState(true);
  const [mensajeSesion, setMensajeSesion] = useState<string | null>(null);

  const limpiarMensajeSesion = useCallback(() => {
    setMensajeSesion(null);
  }, []);

  const cerrarSesion = useCallback(async (mensaje?: string) => {
    setSesion(null);
    setAuthToken(null);
    setMensajeSesion(mensaje ?? null);
    try {
      await borrarSesion();
    } catch (error) {
      console.error('[Auth] No se pudo borrar la sesión segura', error);
    }
  }, []);

  useEffect(() => {
    let montado = true;

    const restaurarSesion = async () => {
      try {
        const recuperada = await leerSesion();
        if (!montado) {
          return;
        }
        if (recuperada) {
          setAuthToken(recuperada.token);
          setSesion(recuperada);
        } else {
          setAuthToken(null);
        }
      } catch (error) {
        console.error('[Auth] No se pudo restaurar la sesión', error);
        if (montado) {
          setAuthToken(null);
          setSesion(null);
        }
      } finally {
        if (montado) {
          setLoading(false);
        }
      }
    };

    void restaurarSesion();

    return () => {
      montado = false;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void cerrarSesion('Tu sesión expiró. Inicia sesión de nuevo.');
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [cerrarSesion]);

  const login = useCallback(async (nuevaSesion: Sesion) => {
    if (!esSesionVigente(nuevaSesion)) {
      throw new Error('La sesión recibida no es válida o ya expiró');
    }
    await guardarSesion(nuevaSesion);
    setAuthToken(nuevaSesion.token);
    setSesion(nuevaSesion);
    setMensajeSesion(null);
  }, []);

  const logout = useCallback(async () => {
    await cerrarSesion('Has cerrado sesión');
  }, [cerrarSesion]);

  return (
    <AuthContext.Provider
      value={{
        user: sesion?.usuario ?? null,
        login,
        logout,
        mensajeSesion,
        limpiarMensajeSesion,
        loading,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};
