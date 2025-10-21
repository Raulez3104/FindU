import React from 'react';
import { ScrollView, TouchableOpacity, Text } from 'react-native';
import { TabType } from '@/types';


interface CategoryTabsProps {
  selected: TabType;
  onSelect: (tab: TabType) => void; // Cambiado de string a TabType
}

const CategoryTabs: React.FC<CategoryTabsProps> = ({ selected, onSelect }) => {
  const tabs: TabType[] = ['Todos', 'Biblioteca', 'Cafetería', 'Cursos'];

  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      className="px-4 py-4"
    >
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab}
          onPress={() => onSelect(tab)}
          className={`mr-3 px-6 py-3 rounded-full ${
            selected === tab ? 'bg-cyan-400' : 'bg-white'
          }`}
        >
          <Text className={`font-semibold ${
            selected === tab ? 'text-white' : 'text-gray-700'
          }`}>
            {tab}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

export default CategoryTabs;