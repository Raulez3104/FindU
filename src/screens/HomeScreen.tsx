import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import Header from '@/components/Header';
import SearchBar from '@/components/SearchBar';
import CategoryTabs from '@/components/CategoryTabs';
import MapView from '@/components/MapView';
import RecentItems from '@/components/RecentItems';
import { TabType } from '@/types';
import '../../global.css';

const HomeScreen: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<TabType>('Todos');
  const [searchQuery, setSearchQuery] = useState<string>('');

  return (
    <View className="flex-1 bg-gray-50">
      <Header />
      <SearchBar 
        value={searchQuery} 
        onChangeText={setSearchQuery} 
      />
      
      <ScrollView className="flex-1">
        <CategoryTabs 
          selected={selectedTab} 
          onSelect={setSelectedTab} 
        />
        <MapView />
        <RecentItems />
      </ScrollView>

    </View>
  );
};

export default HomeScreen;