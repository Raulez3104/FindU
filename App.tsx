import React from 'react';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from '@/navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}
