// src/screens/LoginScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, Alert, ActivityIndicator, Platform } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../../global.css';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

WebBrowser.maybeCompleteAuthSession();

type RootStackParamList = {
  Login: undefined;
  AppTabs: undefined;
};

type LoginScreenProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

const GOOGLE_WEB_CLIENT_ID = '463861565017-sl974mbuokl4q7r27feoc46iht61d3b6.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = '463861565017-0kc0pe8el7u8m1okotgcgm7k2bc130j8.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = 'TU_IOS_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_EXPO_CLIENT_ID = '463861565017-n5ho9beaohbg59tlab57q3u0hh7025ef.apps.googleusercontent.com';

const LoginScreen: React.FC = () => {
  const navigation = useNavigation<LoginScreenProp>();
  const { login } = useAuth(); // ⚠️ usar login en lugar de setUser
  const [loading, setLoading] = useState(false);

  const clientId =
    Platform.OS === 'android'
      ? GOOGLE_ANDROID_CLIENT_ID
      : Platform.OS === 'ios'
      ? GOOGLE_IOS_CLIENT_ID
      : Platform.OS === 'web'
      ? GOOGLE_WEB_CLIENT_ID
      : GOOGLE_EXPO_CLIENT_ID;

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId,
    scopes: ['profile', 'email'],
  });

  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleSuccess(response.authentication?.accessToken);
    } else if (response?.type === 'error') {
      setLoading(false);
      Alert.alert('Error', 'Hubo un problema con Google');
    } else if (response?.type === 'cancel') {
      setLoading(false);
      console.log('Usuario canceló el login');
    }
  }, [response]);

  const handleGoogleSuccess = async (accessToken?: string) => {
    if (!accessToken) {
      setLoading(false);
      Alert.alert('Error', 'No se pudo obtener el token de acceso');
      return;
    }

    try {
      // 1️⃣ Obtener datos de usuario desde Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userInfo = await userInfoResponse.json();

      // 2️⃣ Enviar al backend para crear/verificar usuario
      const backendRes = await axios.post('http://localhost:3000/users/google-login', {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      });

      const backendUser = backendRes.data.user;

      // 3️⃣ Guardar usuario en contexto
      login({
        id: backendUser.id,
        name: backendUser.name,
        email: backendUser.email,
        picture: backendUser.picture,
      });

      setLoading(false);
      navigation.navigate('AppTabs');
    } catch (error) {
      console.error('❌ Error al iniciar sesión con Google:', error);
      setLoading(false);
      Alert.alert('Error', 'No se pudo completar el inicio de sesión');
    }
  };

  const handleLogin = async () => {
    if (!request) return;
    setLoading(true);
    try {
      await promptAsync();
    } catch (error) {
      console.error('Error al iniciar Google Auth:', error);
      setLoading(false);
      Alert.alert('Error', 'No se pudo iniciar la autenticación');
    }
  };

  return (
    <SafeAreaProvider>
      <View className="flex-1 justify-center items-center bg-white px-6">
        <Text className="text-3xl font-bold mb-10">Bienvenido a FindU</Text>

        <TouchableOpacity
          onPress={handleLogin}
          disabled={loading || !request}
          className="flex-row items-center bg-red-500 px-6 py-3 rounded-lg"
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Image
                source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg' }}
                className="w-6 h-6 mr-3"
              />
              <Text className="text-white text-lg font-semibold">
                Iniciar sesión con Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        {loading && <Text className="mt-4 text-gray-600">Autenticando con Google...</Text>}
      </View>
    </SafeAreaProvider>
  );
};

export default LoginScreen;
