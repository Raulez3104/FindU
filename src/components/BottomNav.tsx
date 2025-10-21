import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';


const BottomNav: React.FC = () => {
  return (
    <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2">
      <View className="flex-row justify-around items-center">
        <TouchableOpacity className="items-center">
          <View className="bg-blue-500 rounded-full p-3 mb-1">
            <Icon name="map" size={24} color="white" />
          </View>
          <Text className="text-blue-500 font-semibold text-xs">Mapa</Text>
        </TouchableOpacity>

        <TouchableOpacity className="items-center">
          <View className="p-3 mb-1">
            <Icon name="plus-square" size={24} color="#6B7280" />
          </View>
          <Text className="text-gray-600 text-xs">Reportar</Text>
        </TouchableOpacity>

        <TouchableOpacity className="items-center">
          <View className="p-3 mb-1">
            <Icon name="user" size={24} color="#6B7280" />
          </View>
          <Text className="text-gray-600 text-xs">Perfil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default BottomNav;
