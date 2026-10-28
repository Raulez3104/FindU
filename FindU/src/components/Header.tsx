import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';


const Header: React.FC = () => {
  return (
    <View className="bg-white px-4 pt-4 pb-4 shadow-sm">
      <View className="flex-row justify-between items-center">
        <Text className="text-2xl font-bold text-gray-900">
          FindU Campus
        </Text>
        <TouchableOpacity>
          <Icon name="settings" size={26} color="#6B7280" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Header;