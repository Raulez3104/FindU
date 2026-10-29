import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { obtenerPerfil, type UsuarioPerfil } from '../services/userService';
import { obtenerReportesUsuario, type Reporte } from '../services/reportService';
import { formatearFechaHoraVisible } from '../utils/calendar';

const ProfileScreen = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const [perfil, setPerfil] = useState<UsuarioPerfil | null>(null);
  const [reports, setReports] = useState<Reporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const cargarPerfilYReportes = useCallback(
    async (esRefresco = false) => {
      if (!user?.id) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (esRefresco) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const [perfilCargado, reportesCargados] = await Promise.all([
          obtenerPerfil(user.id),
          obtenerReportesUsuario(user.id),
        ]);
        setPerfil(perfilCargado);
        setReports(reportesCargados);
      } catch (fallo) {
        console.error('Error al cargar el perfil:', fallo);
        setError('No se pudieron cargar tu perfil y tus reportes.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id]
  );

  useFocusEffect(
    useCallback(() => {
      void cargarPerfilYReportes(false);
    }, [cargarPerfilYReportes])
  );

  const onRefresh = () => {
    void cargarPerfilYReportes(true);
  };

  const cerrarSesion = async () => {
    setLogoutLoading(true);
    try {
      await logout();
    } catch (fallo) {
      console.error('Error al cerrar sesión:', fallo);
    } finally {
      setLogoutLoading(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      setShowConfirmModal(true);
      return;
    }

    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro que deseas cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: () => void cerrarSesion(),
        },
      ],
      { cancelable: true }
    );
  };

  const nombre = perfil?.nombre ?? user?.nombre ?? 'Usuario';
  const correo = perfil?.correo ?? user?.correo ?? '';
  const foto = perfil?.foto ?? user?.foto ?? null;
  const activos = reports.filter((reporte) => reporte.activo).length;
  const archivados = reports.length - activos;

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fb8500" />
      }>
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}>
        <View className="flex-1 items-center justify-center bg-black/50">
          <View className="w-11/12 max-w-md rounded-lg bg-white p-6">
            <Text className="mb-2 text-lg font-bold">Cerrar sesión</Text>
            <Text className="mb-4 text-gray-700">¿Estás seguro que deseas cerrar sesión?</Text>
            <View className="flex-row justify-end">
              <TouchableOpacity
                onPress={() => setShowConfirmModal(false)}
                className="mr-2 px-4 py-2">
                <Text className="text-gray-600">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowConfirmModal(false);
                  void cerrarSesion();
                }}
                className="rounded bg-red-500 px-4 py-2">
                <Text className="text-white">Cerrar sesión</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View className="flex-row items-center border-b border-gray-200 bg-white px-4 py-3">
        <Text className="flex-1 text-center text-xl font-bold">Perfil</Text>
        <TouchableOpacity onPress={handleLogout} disabled={logoutLoading}>
          {logoutLoading ? (
            <ActivityIndicator size="small" color="red" />
          ) : (
            <Ionicons name="log-out-outline" size={24} color="red" />
          )}
        </TouchableOpacity>
      </View>

      <View className="items-center bg-white pb-6 pt-8">
        {foto ? (
          <Image
            source={{ uri: foto }}
            className="mb-4 h-36 w-36 rounded-full"
            resizeMode="cover"
          />
        ) : (
          <View className="mb-4 h-36 w-36 items-center justify-center rounded-full bg-amber-100">
            <Ionicons name="person" size={64} color="#fb8500" />
          </View>
        )}
        <Text className="mb-1 text-2xl font-bold text-gray-900">{nombre}</Text>
        <Text className="mb-1 text-base text-gray-500">{correo}</Text>
        <Text className="text-sm text-gray-400">ID: {user?.id ?? ''}</Text>
      </View>

      <View className="px-4 py-6">
        <Text className="mb-4 text-xl font-bold text-gray-900">Estadísticas</Text>
        <View className="flex-row justify-between">
          <View className="mr-2 flex-1 items-center rounded-2xl bg-white p-5">
            <Text className="mb-1 text-4xl font-bold text-[#fb8500]">{reports.length}</Text>
            <Text className="text-center text-sm text-gray-500">Reportes{'\n'}publicados</Text>
          </View>
          <View className="mx-2 flex-1 items-center rounded-2xl bg-white p-5">
            <Text className="mb-1 text-4xl font-bold text-[#fb8500]">{activos}</Text>
            <Text className="text-center text-sm text-gray-500">Reportes{'\n'}activos</Text>
          </View>
          <View className="ml-2 flex-1 items-center rounded-2xl bg-white p-5">
            <Text className="mb-1 text-4xl font-bold text-[#fb8500]">{archivados}</Text>
            <Text className="text-center text-sm text-gray-500">Reportes{'\n'}archivados</Text>
          </View>
        </View>
      </View>

      <View className="px-4 pb-24">
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-xl font-bold text-gray-900">Mis reportes</Text>
          {reports.length > 0 && (
            <View className="rounded-full bg-orange-100 px-3 py-1">
              <Text className="text-sm font-semibold text-[#fb8500]">{reports.length}</Text>
            </View>
          )}
        </View>

        {error ? <Text className="mb-3 text-red-600">{error}</Text> : null}

        {loading ? (
          <ActivityIndicator size="large" color="#fb8500" />
        ) : reports.length === 0 ? (
          <View className="items-center justify-center py-12">
            <Ionicons name="clipboard-outline" size={48} color="#cbd5e1" />
            <Text className="mt-4 text-center text-base text-gray-400">
              No tienes reportes todavía.
            </Text>
            <TouchableOpacity
              onPress={() => navigation?.navigate('Report')}
              className="mt-6 rounded-full bg-[#fb8500] px-6 py-2">
              <Text className="font-semibold text-white">Crear reporte</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="space-y-3">
            {reports.map((reporte) => {
              const ubicacion =
                reporte.ubicacion_nombre || reporte.ubicacion_otro || 'Sin ubicación';
              const perdido = reporte.tipo_reporte === 'perdido';
              return (
                <TouchableOpacity
                  key={reporte.id}
                  onPress={() => navigation?.navigate('ItemDetails', { id: reporte.id })}
                  className="flex-row items-center rounded-xl border-l-4 bg-white p-4 shadow-sm"
                  style={{
                    borderLeftColor: perdido ? '#ef4444' : '#10b981',
                  }}>
                  <View
                    className="mr-3 h-12 w-12 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: perdido ? '#fee2e2' : '#dcfce7',
                    }}>
                    <Ionicons
                      name={perdido ? 'alert-circle' : 'checkmark-circle'}
                      size={28}
                      color={perdido ? '#ef4444' : '#10b981'}
                    />
                  </View>

                  <View className="mr-3 flex-1">
                    <Text className="mb-1 text-base font-semibold text-gray-900" numberOfLines={1}>
                      {reporte.titulo}
                    </Text>
                    <Text className="text-xs text-gray-500" numberOfLines={1}>
                      {reporte.categoria_nombre} · {ubicacion}
                    </Text>
                    <Text className="mt-1 text-xs text-gray-400">
                      {formatearFechaHoraVisible(reporte.fecha)}
                    </Text>
                  </View>

                  <View className="items-end">
                    <View className="rounded-full bg-gray-100 px-3 py-1">
                      <Text className="text-xs font-semibold text-gray-700">{reporte.estado}</Text>
                    </View>
                    <View
                      className={`mt-1 rounded-full px-3 py-1 ${
                        reporte.activo ? 'bg-green-50' : 'bg-gray-100'
                      }`}>
                      <Text
                        className={`text-xs font-semibold ${
                          reporte.activo ? 'text-green-700' : 'text-gray-500'
                        }`}>
                        {reporte.activo ? 'Activo' : 'Archivado'}
                      </Text>
                    </View>
                  </View>

                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default ProfileScreen;
