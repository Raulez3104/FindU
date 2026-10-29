import React from 'react';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from '@/navigation/AppNavigator';
import FlashMessage from 'react-native-flash-message';

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
      <FlashMessage position="top" /> 
    </AuthProvider>
  );
}
