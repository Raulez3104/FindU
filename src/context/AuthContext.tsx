import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id?: number;
  name?: string;
  email?: string;
  picture?: string;
}

interface StoredUser {
  user: User;
  expiresAt: number; // timestamp in ms
}

interface AuthContextType {
  user: User | null;
  login: (userData: User, ttlHours?: number) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession?: (ttlHours?: number) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        console.log('[Auth] loadUser: starting');
        const jsonValue = await AsyncStorage.getItem('@user');
        if (!jsonValue) {
          console.log('[Auth] loadUser: no stored user');
          return;
        }
        const parsed = JSON.parse(jsonValue) as StoredUser | User;
        console.log('[Auth] loadUser: parsed stored value', parsed);

        if (parsed && (parsed as StoredUser).expiresAt) {
          const stored = parsed as StoredUser;
          if (Date.now() < stored.expiresAt) {
            console.log('[Auth] loadUser: session valid, restoring user');
            setUser(stored.user);
          } else {
            console.log('[Auth] loadUser: session expired, removing');
            await AsyncStorage.removeItem('@user');
            setUser(null);
          }
        } else if (parsed) {
          console.log('[Auth] loadUser: found legacy user, migrating to stored format');
          const fallbackUser = parsed as User;
          setUser(fallbackUser);
          // Guardar de nuevo con expiración por defecto (7 días)
          const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
          const stored: StoredUser = { user: fallbackUser, expiresAt };
          await AsyncStorage.setItem('@user', JSON.stringify(stored));
        }
      } catch (e) {
        console.error('[Auth] Error al cargar usuario', e);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  // Guardar usuario en AsyncStorage al iniciar sesión
  const login = async (userData: User, ttlHours = 7 * 24) => {
    console.log('[Auth] login: saving user', userData);
    setUser(userData);
    try {
      const expiresAt = Date.now() + ttlHours * 60 * 60 * 1000;
      const stored: StoredUser = { user: userData, expiresAt };
      await AsyncStorage.setItem('@user', JSON.stringify(stored));
      console.log('[Auth] login: saved with expiresAt', new Date(expiresAt).toISOString());
    } catch (e) {
      console.error('[Auth] Error al guardar usuario', e);
    }
  };

  // Renovar sesión (extiende la expiración)
  const refreshSession = async (ttlHours = 7 * 24) => {
    try {
      console.log('[Auth] refreshSession: attempting to refresh');
      const jsonValue = await AsyncStorage.getItem('@user');
      if (!jsonValue) {
        console.log('[Auth] refreshSession: no stored user');
        return;
      }
      const parsed = JSON.parse(jsonValue) as StoredUser | null;
      if (!parsed || !(parsed as StoredUser).user) {
        console.log('[Auth] refreshSession: parsed invalid');
        return;
      }
      const stored = parsed as StoredUser;
      if (Date.now() >= stored.expiresAt) {
        console.log('[Auth] refreshSession: already expired');
        return; // no renovar si ya expiró
      }
      const newExpiresAt = Date.now() + ttlHours * 60 * 60 * 1000;
      const newStored: StoredUser = { user: stored.user, expiresAt: newExpiresAt };
      await AsyncStorage.setItem('@user', JSON.stringify(newStored));
      console.log('[Auth] refreshSession: renewed until', new Date(newExpiresAt).toISOString());
    } catch (e) {
      console.error('[Auth] Error al renovar sesión', e);
    }
  };

  // Cerrar sesión
  const logout = async () => {
    console.log('[Auth] logout: starting');
    setUser(null);
    try {
      await AsyncStorage.removeItem('@user');
      console.log('[Auth] logout: storage cleared');
    } catch (e) {
      console.error('[Auth] Error al cerrar sesión', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshSession, loading }}>
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
