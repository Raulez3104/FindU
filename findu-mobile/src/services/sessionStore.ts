import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Sesion } from '../types';
import { parsearSesion } from '../utils/session';

const CLAVE_SESION = 'findu.sesion';

export async function guardarSesion(sesion: Sesion): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  await SecureStore.setItemAsync(CLAVE_SESION, JSON.stringify(sesion));
}

export async function leerSesion(ahora: number = Date.now()): Promise<Sesion | null> {
  if (Platform.OS === 'web') {
    return null;
  }
  const crudo = await SecureStore.getItemAsync(CLAVE_SESION);
  const sesion = parsearSesion(crudo, ahora);
  if (!sesion && crudo !== null) {
    await borrarSesion();
  }
  return sesion;
}

export async function borrarSesion(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  await SecureStore.deleteItemAsync(CLAVE_SESION);
}
