import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
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
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      axios
        .get(`http://localhost:3000/reports/user/${user.id}`)
        .then(res => {
          setReports(res.data.reports);
        })
        .catch(err => {
          console.error('Error al obtener reportes:', err);
        })
        .finally(() => setLoading(false));
    }
  }, [user]);

  const userData = {
    name: user?.name || 'Nombre de Usuario',
    email: user?.email || 'correo@ejemplo.com',
    id: user?.id || '12345678',
    stats: {
      reported: reports.length,
      found: reports.filter(r => r.status === 'Encontrado').length,
      rewards: 3, // puedes calcular o traerlo de backend si existe
    },
    gamification: {
      level: 3,
      levelProgress: 60,
      reportPoints: 1200,
      reportPointsProgress: 80,
      ranking: 25,
      rankingPercentile: 'Top 10%',
    },
  };

  return (
    <ScrollView className="flex-1 bg-white">
      {/* Header */}
      <View className="bg-white px-4 py-3 flex-row items-center border-b border-gray-200">
        <Text className="flex-1 text-center text-xl font-bold">Perfil</Text>
        <View className="w-7" />
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
            <Text className="text-4xl font-bold text-cyan-400 mb-1">{userData.stats.reported}</Text>
            <Text className="text-sm text-gray-500 text-center">Objetos{'\n'}reportados</Text>
          </View>
          <View className="bg-white rounded-2xl p-5 items-center flex-1 mx-2">
            <Text className="text-4xl font-bold text-cyan-400 mb-1">{userData.stats.found}</Text>
            <Text className="text-sm text-gray-500 text-center">Objetos{'\n'}encontrados</Text>
          </View>
          <View className="bg-white rounded-2xl p-5 items-center flex-1 ml-2">
            <Text className="text-4xl font-bold text-cyan-400 mb-1">{userData.stats.rewards}</Text>
            <Text className="text-sm text-gray-500 text-center">Recompensas</Text>
          </View>
        </View>
      </View>

      {/* Gamificación */}
      <View className="px-4 pb-6">
        <Text className="text-xl font-bold text-gray-900 mb-4">Hitos</Text>

        {/* Nivel */}
        <View className="bg-white rounded-2xl p-5 mb-3 flex-row items-center">
          <View className="w-14 h-14 rounded-full bg-cyan-100 items-center justify-center mr-4">
            <Ionicons name="trophy" size={24} color="#22d3ee" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900 mb-1">Nivel de Usuario</Text>
            <Text className="text-sm text-gray-500 mb-2">Nivel {userData.gamification.level}</Text>
            <View className="flex-row items-center">
              <View className="flex-1 h-2 bg-gray-200 rounded-full mr-3">
                <View
                  className="h-2 bg-cyan-400 rounded-full"
                  style={{ width: `${userData.gamification.levelProgress}%` }}
                />
              </View>
            </View>
          </View>
          <Text className="text-2xl font-bold text-cyan-400">{userData.gamification.levelProgress}%</Text>
        </View>

        {/* Puntos de Reporte */}
        <View className="bg-white rounded-2xl p-5 mb-3 flex-row items-center">
          <View className="w-14 h-14 rounded-full bg-cyan-100 items-center justify-center mr-4">
            <Ionicons name="star" size={24} color="#22d3ee" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900 mb-1">Puntos de Reporte</Text>
            <Text className="text-sm text-gray-500 mb-2">{userData.gamification.reportPoints} puntos</Text>
            <View className="flex-row items-center">
              <View className="flex-1 h-2 bg-gray-200 rounded-full mr-3">
                <View
                  className="h-2 bg-cyan-400 rounded-full"
                  style={{ width: `${userData.gamification.reportPointsProgress}%` }}
                />
              </View>
            </View>
          </View>
          <Text className="text-2xl font-bold text-cyan-400">{userData.gamification.reportPointsProgress}%</Text>
        </View>

        {/* Ranking */}
        <View className="bg-white rounded-2xl p-5 flex-row items-center">
          <View className="w-14 h-14 rounded-full bg-cyan-100 items-center justify-center mr-4">
            <Ionicons name="people" size={24} color="#22d3ee" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900 mb-1">Ranking de Usuarios</Text>
            <Text className="text-sm text-gray-500">{userData.gamification.rankingPercentile}</Text>
          </View>
          <Text className="text-2xl font-bold text-cyan-400">#{userData.gamification.ranking}</Text>
        </View>
      </View>

      {/* Historial de Reportes */}
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
