import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { LostItem, TabType } from '@/types';
import { formatearFechaHoraVisible, formatearFechaVisible } from '@/utils/calendar';

interface RecentItemsProps {
  items: LostItem[];
  selectedTab: TabType;
  onItemPress?: (id: number, item?: LostItem) => void;
}

const RecentItems: React.FC<RecentItemsProps> = ({ items, selectedTab, onItemPress }) => {
  const filteredItems = items.filter(
    (item) =>
      selectedTab === 'Todos' || item.ubicacion.toLowerCase().includes(selectedTab.toLowerCase())
  );

  return (
    <View className="px-4 pb-24">
      <Text className="mb-4 text-2xl font-bold text-gray-900">Objetos Recientes</Text>

      {filteredItems.length === 0 && (
        <Text className="py-8 text-center text-gray-500">No hay reportes para este filtro.</Text>
      )}

      {filteredItems.map((item) => (
        <TouchableOpacity
          key={item.id}
          onPress={() => (onItemPress ? onItemPress(Number(item.id), item) : undefined)}
          className="mb-3 flex-row items-center rounded-2xl bg-white p-4 shadow-sm">
          <View className="mr-4 h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} className="h-full w-full" resizeMode="cover" />
            ) : (
              <Icon name="image" size={24} color="#9CA3AF" />
            )}
          </View>

          <View className="flex-1">
            <Text className="mb-1 text-lg font-semibold text-gray-900" numberOfLines={1}>
              {item.name}
            </Text>
            <View className="flex-row items-center">
              <Text className={`${item.statusColor} font-semibold capitalize`}>{item.tipo}</Text>
              <Text className="mx-1 text-gray-400">·</Text>
              <Text className="font-medium text-gray-600">{item.estado}</Text>
            </View>
            <Text className="mt-1 text-sm text-gray-600" numberOfLines={1}>
              {item.categoria} · {item.ubicacion}
            </Text>
            <Text className="mt-1 text-xs text-gray-400">
              Incidente: {formatearFechaVisible(item.fechaIncidente)} · Publicado:{' '}
              {formatearFechaHoraVisible(item.fechaCreacion)}
            </Text>
            {item.autor ? (
              <Text className="mt-1 text-xs text-gray-400" numberOfLines={1}>
                Publicado por {item.autor}
              </Text>
            ) : null}
          </View>

          <Icon name="chevron-right" size={24} color="#9CA3AF" />
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default RecentItems;
