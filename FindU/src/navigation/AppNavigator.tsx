import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';

import HomeScreen from '@/screens/HomeScreen';
import ReportScreen from '@/screens/ReportScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import LoginScreen from '@/screens/LoginScreen';
import ItemDetailsScreen from '@/screens/ItemDetailsScreen';
import { useAuth } from '@/context/AuthContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MyTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          height: 70,
          paddingBottom: 4,
          paddingTop: 15,
          paddingHorizontal: 4,
          width: '100%',
        },
        tabBarIcon: ({ focused }) => {
          let iconName = '';
          let label = '';

          if (route.name === 'Home') {
            iconName = 'home';
            label = 'Inicio';
          } else if (route.name === 'Report') {
            iconName = 'plus-square';
            label = 'Reportar';
          } else if (route.name === 'Profile') {
            iconName = 'user';
            label = 'Perfil';
          }

          return (
            <View className="flex-1 items-center justify-center">
              <Icon name={iconName} size={25} color={focused ? '#fb8500' : '#9CA3AF'} />
              <Text
                className={`mt-1 w-16 text-center text-xs ${
                  focused ? 'font-semibold text-gray-950' : 'text-gray-500'
                }`}
              >
                {label}
              </Text>
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Report" component={ReportScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#fb8500" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="AppTabs" component={MyTabs} />
          <Stack.Screen name="ItemDetails" component={ItemDetailsScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
