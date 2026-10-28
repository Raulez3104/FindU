import React from 'react';
import type { Administrador } from '../types/api';

interface HeaderProps {
  titulo: string;
  subtitulo: string;
  admin: Administrador;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ titulo, subtitulo, admin, onLogout }) => {
  const nombre = admin.nombre || 'Administrador';
  const rol = admin.rol || 'personal';

  return (
    <header className="flex justify-between items-center p-4 bg-white shadow-sm border-b border-gray-200">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{titulo}</h1>
        <p className="text-xs text-gray-500">{subtitulo}</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-900">{nombre}</p>
          <p className="text-xs text-gray-500 uppercase">{rol}</p>
        </div>

        <button
          onClick={onLogout}
          className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors"
        >
          Cerrar Sesión
        </button>
      </div>
    </header>
  );
};

export default Header;
