import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { LostItem, TabType } from '@/types';

interface RecentItemsProps {
  items: LostItem[];
  selectedTab: TabType;
  onItemPress?: (id: number, item?: LostItem) => void;
}

const RecentItems: React.FC<RecentItemsProps> = ({ items, selectedTab, onItemPress }) => {
  // Filtrar por tab
  const filteredItems = items.filter(item =>
    selectedTab === 'Todos' || item.status.toLowerCase().includes(selectedTab.toLowerCase())
  );

  return (
    <View className="px-4 pb-24">
      <Text className="text-2xl font-bold text-gray-900 mb-4">
        Objetos Recientes
      </Text>

      {filteredItems.map(item => (
        <TouchableOpacity
          key={item.id}
          onPress={() => onItemPress ? onItemPress(Number(item.id), item) : undefined}
          className="bg-white rounded-2xl p-4 mb-3 flex-row items-center shadow-sm"
        >
          <View className="w-16 h-16 mr-4">
            <Image
              source={{ uri: item.imageUrl }}
              className="w-full h-full rounded-xl"
              resizeMode="cover"
            />
          </View>

          <View className="flex-1">
            <Text className="text-lg font-semibold text-gray-900 mb-1">
              {item.name}
            </Text>
            <Text className={`${item.statusColor} font-medium`}>
              {item.status}
            </Text>
          </View>

          <Icon name="chevron-right" size={24} color="#9CA3AF" />
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default RecentItems;
