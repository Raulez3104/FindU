import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
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
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (user?.id) {
      axios
        .get(`http://localhost:3000/reports/user/${user.id}`)
        .then(res => setReports(res.data.reports))
        .catch(err => console.error('Error al obtener reportes:', err))
        .finally(() => setLoading(false));
    }
  }, [user]);

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
    <ScrollView className="flex-1 bg-white">
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
        <Text className="text-xl font-bold text-gray-900 mb-4">Historial de Reportes</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#22d3ee" />
        ) : reports.length === 0 ? (
          <Text className="text-gray-500">No tienes reportes todavía.</Text>
        ) : (
          reports.map(report => (
            <View key={report.id} className="bg-white rounded-2xl p-5 mb-3 flex-row items-center">
              <View className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center mr-4">
                <Ionicons
                  name={report.status === 'Encontrado' ? 'checkmark-circle' : 'alert-circle'}
                  size={24}
                  color={report.status === 'Encontrado' ? 'green' : 'red'}
                />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900 mb-1">{report.title}</Text>
                <Text
                  className={`text-sm ${
                    report.status === 'Encontrado' ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {report.status}
                </Text>
              </View>
              <Text className="text-sm text-gray-400">{report.date}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

export default ProfileScreen;
