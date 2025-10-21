import React from 'react';
import { View, Text, Image, StyleProp, ViewStyle } from 'react-native';

interface Location {
  name: string;
  x: number;
  y: number;
  color: 'red' | 'green';
}

const locations: Location[] = [
  { name: 'Mochila', x: 100, y: 80, color: 'red' },
  { name: 'Gafas', x: 180, y: 180, color: 'red' },
  { name: 'Llaves', x: 220, y: 140, color: 'green' }
];

const MapView: React.FC = () => {
  return (
    <View className="mx-4 mb-6 rounded-3xl overflow-hidden h-80 relative">
      <Image
        source={require('../../assets/images/piso3.jpg')} 
        className="w-full h-full"
        resizeMode="cover"
      />
      
      {/* Location Markers */}
      {locations.map((loc, idx) => {
        const markerStyle: StyleProp<ViewStyle> = {
          position: 'absolute',
          left: loc.x,
          top: loc.y
        };

        return (
          <View key={idx} style={markerStyle}>
            <View className="bg-white px-3 py-1 rounded-full mb-1">
              <Text className={`font-semibold text-sm ${
                loc.color === 'red' ? 'text-red-500' : 'text-green-500'
              }`}>
                {loc.name}
              </Text>
            </View>
            <View className={`w-4 h-4 ${
              loc.color === 'red' ? 'bg-red-500' : 'bg-green-500'
            } rounded-full self-center shadow-lg`} />
          </View>
        );
      })}
    </View>
  );
};

export default MapView;
