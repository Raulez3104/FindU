import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';


interface Item {
  id: number;
  name: string;
  status: string;
  statusColor: string; // Tailwind class as string
  icon: string;
}

const items: Item[] = [
  {
    id: 1,
    name: 'Mochila negra',
    status: 'Perdido en Biblioteca',
    statusColor: 'text-red-500',
    icon: '🎒'
  },
  {
    id: 2,
    name: 'Llaves de coche',
    status: 'Encontrado en Cafetería',
    statusColor: 'text-green-500',
    icon: '🔑'
  }
];

const RecentItems: React.FC = () => {
  return (
    <View className="px-4 pb-24">
      <Text className="text-2xl font-bold text-gray-900 mb-4">
        Objetos Recientes
      </Text>

      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          className="bg-white rounded-2xl p-4 mb-3 flex-row items-center shadow-sm"
        >
          <View className="bg-gray-100 rounded-xl w-16 h-16 items-center justify-center mr-4">
            <Text className="text-3xl">{item.icon}</Text>
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
