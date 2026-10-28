import React, { useCallback, useState } from 'react';
import { Text, View, ScrollView } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Header from '@/components/Header';
import SearchBar from '@/components/SearchBar';
import CategoryTabs from '@/components/CategoryTabs';
import RecentItems from '@/components/RecentItems';
import { listarReportes, type Reporte } from '@/services/reportService';
import { TabType, LostItem } from '@/types';
import '../../global.css';

function reporteALostItem(reporte: Reporte): LostItem {
  const ubicacion = reporte.ubicacion_nombre || reporte.ubicacion_otro || 'Sin ubicación';
  return {
    id: reporte.id,
    name: reporte.titulo,
    status: ubicacion,
    statusColor: reporte.tipo_reporte === 'perdido' ? 'text-red-500' : 'text-green-600',
    imageUrl: reporte.imageUrl,
    categoria: reporte.categoria_nombre || 'Sin categoría',
    fechaIncidente: reporte.fecha_incidente,
    fechaCreacion: reporte.fecha,
    campus: reporte.campus,
    ubicacion,
    tipo: reporte.tipo_reporte,
    estado: reporte.estado,
    autor: reporte.administrador_nombre || reporte.usuario_nombre || null,
  };
}

const HomeScreen: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<TabType>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [reports, setReports] = useState<LostItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      setError(null);
      const reportes = await listarReportes();
      setReports(reportes.map(reporteALostItem));
    } catch (fallo) {
      console.error('Error al obtener reportes:', fallo);
      setError('No se pudieron cargar los reportes. Revisa tu conexión.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchReports();
    }, [fetchReports])
  );

  const busqueda = searchQuery.trim().toLowerCase();
  const filteredReports = reports.filter((reporte) => {
    if (!busqueda) {
      return true;
    }
    return [
      reporte.name,
      reporte.categoria,
      reporte.ubicacion,
      reporte.autor ?? '',
      reporte.estado,
    ].some((valor) => valor.toLowerCase().includes(busqueda));
  });

  const navigation = useNavigation();

  const handleItemPress = (id: number, item?: LostItem) => {
    // @ts-ignore
    navigation.navigate('ItemDetails', { id, preview: item });
  };

  return (
    <View className="flex-1 bg-gray-50">
      <Header />
      <SearchBar value={searchQuery} onChangeText={setSearchQuery} />

      <ScrollView className="flex-1">
        <CategoryTabs selected={selectedTab} onSelect={setSelectedTab} />
        {error ? <Text className="px-4 pb-2 text-red-600">{error}</Text> : null}
        <RecentItems
          items={filteredReports}
          selectedTab={selectedTab}
          onItemPress={handleItemPress}
        />
      </ScrollView>
    </View>
  );
};

export default HomeScreen;
