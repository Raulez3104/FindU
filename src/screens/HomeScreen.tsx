import React, { useState, useCallback } from 'react';
import { View, ScrollView } from 'react-native';
import axios from 'axios';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Header from '@/components/Header';
import SearchBar from '@/components/SearchBar';
import CategoryTabs from '@/components/CategoryTabs';
import RecentItems from '@/components/RecentItems';
import { TabType, LostItem } from '@/types';
import '../../global.css';

const HomeScreen: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<TabType>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [reports, setReports] = useState<LostItem[]>([]);

  // Función para obtener los reportes del backend
  const fetchReports = async () => {
    try {
      const res = await axios.get('http://localhost:3000/reports'); // Ajusta endpoint si necesitas
      const data: LostItem[] = res.data.map((r: any) => {
        const normalizedStatus = r.status.toLowerCase().trim();
        return {
          id: r.id,
          name: r.title,
          status:
            normalizedStatus === 'perdido'
              ? `Perdido en ${r.location}`
              : `Encontrado en ${r.location}`,
          statusColor:
            normalizedStatus === 'perdido' ? 'text-red-500' : 'text-green-500',
          imageUrl: r.imageUrl || 'https://via.placeholder.com/100',
        };
      });
      setReports(data);
    } catch (err) {
      console.error('Error al obtener reportes:', err);
    }
  };

  // Recargar reportes cada vez que la pantalla se enfoca
  useFocusEffect(
    useCallback(() => {
      fetchReports();
    }, [])
  );

  // Filtrar por búsqueda
  const filteredReports = reports.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const navigation = useNavigation();

  const handleItemPress = (id: number, item?: LostItem) => {
    // Navegar a la pantalla de detalle, pasar id y preview
    // @ts-ignore
    navigation.navigate('ItemDetails', { id, preview: item });
  };

  return (
    <View className="flex-1 bg-gray-50">
      <Header />
      <SearchBar value={searchQuery} onChangeText={setSearchQuery} />

      <ScrollView className="flex-1">
        <CategoryTabs selected={selectedTab} onSelect={setSelectedTab} />
        <RecentItems items={filteredReports} selectedTab={selectedTab} onItemPress={handleItemPress} />
      </ScrollView>
    </View>
  );
};

export default HomeScreen;
