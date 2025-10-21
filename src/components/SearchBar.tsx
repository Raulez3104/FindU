import React from 'react';
import { View, TextInput, TextInputProps } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';


interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChangeText }) => {
  return (
    <View className="bg-white px-4 pb-4">
      <View className="bg-gray-100 rounded-full px-4 py-3 flex-row items-center">
        <Icon name="search" size={20} color="#9CA3AF" />
        <TextInput
          className="flex-1 ml-2 text-gray-700 text-base"
          placeholder="Mochila en facultad de ingeniería..."
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor="#9CA3AF"
        />
      </View>
    </View>
  );
};

export default SearchBar;
