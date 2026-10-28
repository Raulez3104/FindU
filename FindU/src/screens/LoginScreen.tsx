// src/screens/LoginScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../../global.css';
import { useAuth } from '../context/AuthContext';
import { GOOGLE_CLIENT_IDS, getGoogleClientId } from '../config/env';
import { iniciarSesionGoogle } from '../services/userService';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_ICON =
  'https://lh3.googleusercontent.com/COxitqgJr1sJnIDe8-jiKhxDx1FrYbtRHKJ9z_hELisAlapwE9LUPh6fcXIfb5vwpbMl4xl9H9TRFPc5NOO8Sb3VSgIBrfRYvW6cUA';

interface BotonGoogleProps {
  cargando: boolean;
  onInicio: () => void;
  onIdToken: (idToken: string) => void;
  onError: (mensaje: string) => void;
}

function BotonGoogle({ cargando, onInicio, onIdToken, onError }: BotonGoogleProps) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_CLIENT_IDS.expo || undefined,
    webClientId: GOOGLE_CLIENT_IDS.web || undefined,
    iosClientId: GOOGLE_CLIENT_IDS.ios || undefined,
    androidClientId: GOOGLE_CLIENT_IDS.android || undefined,
    scopes: ['openid', 'profile', 'email'],
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params?.id_token ?? response.authentication?.idToken;
      if (!idToken) {
        onError('Google no devolvió un identificador válido.');
        return;
      }
      onIdToken(idToken);
    } else if (response?.type === 'error') {
      onError('No se pudo autenticar con Google.');
    } else if (response?.type === 'cancel' || response?.type === 'dismiss') {
      onError('Inicio de sesión cancelado.');
    }
  }, [response, onIdToken, onError]);

  const handlePress = async () => {
    onInicio();

    if (!request) {
      onError('Google todavía no está listo. Intenta de nuevo.');
      return;
    }

    try {
      await promptAsync();
    } catch (fallo) {
      console.error('Error al iniciar Google Auth:', fallo);
      onError('No se pudo iniciar la autenticación.');
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={cargando || !request}
      className="flex-row items-center rounded-lg bg-[#fb8500] px-6 py-3">
      {cargando ? (
        <ActivityIndicator color="white" />
      ) : (
        <>
          <Image source={{ uri: GOOGLE_ICON }} className="mr-3 h-6 w-6" />
          <Text className="text-lg font-semibold text-white">Iniciar sesión con Google</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const LoginScreen: React.FC = () => {
  const { login, mensajeSesion, limpiarMensajeSesion } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clienteGoogle = getGoogleClientId();
  const googleConfigurado =
    Platform.OS === 'web'
      ? Boolean(GOOGLE_CLIENT_IDS.web)
      : Boolean(clienteGoogle || GOOGLE_CLIENT_IDS.expo);

  const informarError = useCallback((mensaje: string) => {
    setError(mensaje);
    setLoading(false);
  }, []);

  const iniciarGoogle = useCallback(() => {
    limpiarMensajeSesion();
    setError(null);
    setLoading(true);
  }, [limpiarMensajeSesion]);

  const canjearIdToken = useCallback(
    async (idToken: string) => {
      setError(null);
      try {
        const sesion = await iniciarSesionGoogle(idToken);
        await login(sesion);
      } catch (fallo) {
        console.error('Error al iniciar sesión con Google:', fallo);
        informarError('No se pudo completar el inicio de sesión.');
      }
    },
    [informarError, login]
  );

  const aviso = error ?? mensajeSesion;

  return (
    <SafeAreaProvider>
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="mb-10 text-3xl font-bold">Bienvenido a Find-U</Text>

        {googleConfigurado ? (
          <BotonGoogle
            cargando={loading}
            onInicio={iniciarGoogle}
            onIdToken={canjearIdToken}
            onError={informarError}
          />
        ) : (
          <>
            <View className="flex-row items-center rounded-lg bg-gray-300 px-6 py-3">
              <Image source={{ uri: GOOGLE_ICON }} className="mr-3 h-6 w-6" />
              <Text className="text-lg font-semibold text-white">Iniciar sesión con Google</Text>
            </View>
            <Text className="mt-4 text-center text-sm text-amber-700">
              Falta configurar el client ID de Google para esta plataforma. Define
              {Platform.OS === 'web'
                ? ' EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'
                : ' EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID/IOS_CLIENT_ID'}{' '}
              en el archivo `.env` de FindU y reinicia Expo.
            </Text>
          </>
        )}

        {loading && <Text className="mt-4 text-gray-600">Autenticando con Google...</Text>}
        {aviso && <Text className="mt-4 text-center text-red-600">{aviso}</Text>}
      </View>
    </SafeAreaProvider>
  );
};

export default LoginScreen;
