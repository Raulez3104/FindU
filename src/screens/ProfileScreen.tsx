import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Platform, Modal, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';

interface Report {
  id: number;
  title: string;
  status: 'Perdido' | 'Encontrado';
  date: string;
}

const ProfileScreen = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const fetchReports = useCallback(() => {
    if (user?.id) {
      axios
        .get(`http://localhost:3000/reports/user/${user.id}`)
        .then(res => setReports(res.data.reports))
        .catch(err => console.error('Error al obtener reportes:', err))
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    }
  }, [user?.id]);

  // Cargar reportes cuando se monta el componente
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Recargar reportes cada vez que la pantalla recibe el foco
  useFocusEffect(
    useCallback(() => {
      fetchReports();
    }, [fetchReports])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchReports();
  };

  const handleLogout = () => {
    console.log('[Profile] handleLogout: pressed');
    // Mostrar modal en web (mejor UX que window.confirm)
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
          onPress: async () => {
            console.log('[Profile] Alert confirmed: calling logout');
            // Esperamos a que el logout limpie el estado y el AsyncStorage.
            setLogoutLoading(true);
            try {
              await logout(); // Esto limpia el usuario del AuthContext
            } catch (e) {
              console.error('Error during logout', e);
            } finally {
              setLogoutLoading(false);
            }
            // No llamamos a navigation.replace aquí: la navegación se ajusta
            // automáticamente desde AppNavigator según el estado de `user`.
          },
        },
      ],
      { cancelable: true }
    );
  };

  const userData = {
    name: user?.name || 'Nombre de Usuario',
    email: user?.email || 'correo@ejemplo.com',
    id: user?.id || '12345678',
    stats: {
      reported: reports.length,
      found: reports.filter(r => r.status === 'Encontrado').length,
      rewards: 3,
    },
  };

  return (
    <ScrollView 
      className="flex-1 bg-gray-50"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fb8500" />}
    >
      {/* Modal para confirmación web */}
      <Modal visible={showConfirmModal} transparent animationType="fade" onRequestClose={() => setShowConfirmModal(false)}>
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-lg p-6 w-11/12 max-w-md">
            <Text className="text-lg font-bold mb-2">Cerrar sesión</Text>
            <Text className="text-gray-700 mb-4">¿Estás seguro que deseas cerrar sesión?</Text>
            <View className="flex-row justify-end">
              <TouchableOpacity onPress={() => setShowConfirmModal(false)} className="px-4 py-2 mr-2">
                <Text className="text-gray-600">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  setShowConfirmModal(false);
                  setLogoutLoading(true);
                  try {
                    await logout();
                  } catch (e) {
                    console.error('Error during logout', e);
                  } finally {
                    setLogoutLoading(false);
                  }
                }}
                className="px-4 py-2 bg-red-500 rounded"
              >
                <Text className="text-white">Cerrar sesión</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Header */}
      <View className="bg-white px-4 py-3 flex-row items-center border-b border-gray-200">
        <Text className="flex-1 text-center text-xl font-bold">Perfil</Text>
        <TouchableOpacity onPress={handleLogout} disabled={logoutLoading}>
          {logoutLoading ? (
            <ActivityIndicator size="small" color="red" />
          ) : (
            <Ionicons name="log-out-outline" size={24} color="red" />
          )}
        </TouchableOpacity>
      </View>

      {/* Profile Info */}
      <View className="bg-white pt-8 pb-6 items-center">
        <View className="w-36 h-36 rounded-full bg-amber-100 mb-4 overflow-hidden" />
        <Text className="text-2xl font-bold text-gray-900 mb-1">{userData.name}</Text>
        <Text className="text-base text-gray-500 mb-1">{userData.email}</Text>
        <Text className="text-sm text-gray-400">ID: {userData.id}</Text>
      </View>

      {/* Estadísticas */}
      <View className="px-4 py-6">
        <Text className="text-xl font-bold text-gray-900 mb-4">Estadísticas</Text>
        <View className="flex-row justify-between">
          <View className="bg-white rounded-2xl p-5 items-center flex-1 mr-2">
            <Text className="text-4xl font-bold text-[#fb8500] mb-1">{userData.stats.reported}</Text>
            <Text className="text-sm text-gray-500 text-center">Objetos{'\n'}reportados</Text>
          </View>
          <View className="bg-white rounded-2xl p-5 items-center flex-1 mx-2">
            <Text className="text-4xl font-bold text-[#fb8500] mb-1">{userData.stats.found}</Text>
            <Text className="text-sm text-gray-500 text-center">Objetos{'\n'}encontrados</Text>
          </View>
          <View className="bg-white rounded-2xl p-5 items-center flex-1 ml-2">
            <Text className="text-4xl font-bold text-[#fb8500] mb-1">{userData.stats.rewards}</Text>
            <Text className="text-sm text-gray-500 text-center">Recompensas</Text>
          </View>
        </View>
      </View>

      {/* Historial de reportes */}
      <View className="px-4 pb-24">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-xl font-bold text-gray-900">Historial de Reportes</Text>
          {reports.length > 0 && (
            <View className="bg-orange-100 px-3 py-1 rounded-full">
              <Text className="text-sm font-semibold text-[#fb8500]">{reports.length}</Text>
            </View>
          )}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#fb8500" />
        ) : reports.length === 0 ? (
          <View className="items-center justify-center py-12">
            <Ionicons name="clipboard-outline" size={48} color="#cbd5e1" />
            <Text className="text-gray-400 text-center mt-4 text-base">No tienes reportes todavía.</Text>
            <TouchableOpacity 
              onPress={() => navigation?.navigate('HomeScreen')}
              className="mt-6 bg-[#fb8500] px-6 py-2 rounded-full"
            >
              <Text className="text-white font-semibold">Crear Reporte</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="space-y-3">
            {reports.map((report, index) => (
              <View 
                key={report.id} 
                className="bg-white rounded-xl p-4 flex-row items-center shadow-sm border-l-4"
                style={{
                  borderLeftColor: report.status === 'Encontrado' ? '#10b981' : '#ef4444',
                }}
              >
                <View 
                  className="w-12 h-12 rounded-full items-center justify-center mr-3"
                  style={{
                    backgroundColor: report.status === 'Encontrado' ? '#dcfce7' : '#fee2e2',
                  }}
                >
                  <Ionicons
                    name={report.status === 'Encontrado' ? 'checkmark-circle' : 'alert-circle'}
                    size={28}
                    color={report.status === 'Encontrado' ? '#10b981' : '#ef4444'}
                  />
                </View>
                <View className="flex-1 mr-3">
                  <Text className="text-base font-semibold text-gray-900 mb-1" numberOfLines={1}>
                    {report.title}
                  </Text>
                  <View className="flex-row items-center">
                    <Ionicons name="calendar-outline" size={12} color="#9ca3af" />
                    <Text className="text-xs text-gray-500 ml-1">{report.date}</Text>
                  </View>
                </View>
                <View 
                  className="px-3 py-1 rounded-full"
                  style={{
                    backgroundColor: report.status === 'Encontrado' ? '#dcfce7' : '#fee2e2',
                  }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{
                      color: report.status === 'Encontrado' ? '#10b981' : '#ef4444',
                    }}
                  >
                    {report.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

export default ProfileScreen;
