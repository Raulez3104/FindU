import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Package, Users, Settings, LogOut } from 'lucide-react';
import type { Administrador } from '../types/api';

interface SidebarProps {
  admin?: Administrador;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ admin, onLogout }) => {
  const elementosMenu = [
    { id: 'dashboard', icono: <Home size={20} />, texto: 'Inicio', ruta: '/dashboard' },
    { id: 'reportes', icono: <Package size={20} />, texto: 'Reportes', ruta: '/reportes' },
    { id: 'usuarios', icono: <Users size={20} />, texto: 'Usuarios', ruta: '/usuarios' },
    { id: 'configuracion', icono: <Settings size={20} />, texto: 'Configuración', ruta: '/configuracion' },
  ];

  const rolTexto = admin?.rol || 'Administrador';
  const nombreTexto = admin?.nombre || 'Administrador';
  const correoTexto = admin?.correo || '';

  return (
    <aside className="w-64 bg-[#fb8500] min-h-screen flex flex-col shrink-0">
      <div className="p-6 border-b border-white/20">
        <h1 className="text-2xl font-bold text-white">Find-U Admin</h1>
        <p className="text-xs text-white/80 mt-1">Panel de Administración</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {elementosMenu.map((item) => (
          <NavLink
            key={item.id}
            to={item.ruta}
            className={({ isActive }) =>
              `flex items-center gap-3 p-2.5 rounded-lg text-sm text-white transition-colors ${
                isActive ? 'bg-white/25 font-bold' : 'hover:bg-white/15'
              }`
            }
          >
            {item.icono}
            <span>{item.texto}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/20">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 w-full p-2.5 rounded-lg text-sm text-white hover:bg-white/15 transition-colors font-medium"
        >
          <LogOut size={18} />
          Cerrar Sesión
        </button>

        <div className="mt-4 p-3 bg-[#f95738] rounded-lg text-white">
          <p className="text-xs uppercase font-semibold tracking-wider text-white/90">
            {rolTexto}
          </p>
          <p className="text-sm font-bold truncate mt-0.5">{nombreTexto}</p>
          {correoTexto && (
            <p className="text-xs text-white/80 truncate mt-0.5">{correoTexto}</p>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
