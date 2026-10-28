import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import type { AdminData } from '../AppRoutes';

interface AplicacionLayoutProps {
  admin: AdminData;
  onLogout: () => void;
}

const AplicacionLayout: React.FC<AplicacionLayoutProps> = ({ admin, onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();          // Actualiza estado en AppRoutes
    navigate("/login");  // Redirige al login
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <Sidebar admin={admin} onLogout={handleLogout} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          titulo="Panel" 
          subtitulo="Administrador" 
          admin={admin} 
          onLogout={handleLogout} 
        />

        <main className="flex-1 overflow-y-auto bg-gray-100">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AplicacionLayout;
