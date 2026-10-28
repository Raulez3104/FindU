import React from 'react';

interface MenuItemProps {
  icono: React.ReactNode;
  texto: string;
  activo?: boolean;
  alHacer?: () => void;
}

const MenuItem: React.FC<MenuItemProps> = ({ 
  icono, 
  texto, 
  activo = false, 
  alHacer 
}) => {
  return (
    <button
      onClick={alHacer}
      className={`
        w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
        ${activo 
          ? 'bg-[#f95738] text-white shadow-lg' 
          : 'text-white hover:bg-[#f95738] hover:text-white'
        }
      `}
    >
      <span className="w-5 h-5">{icono}</span>
      <span className="font-medium">{texto}</span>
    </button>
  );
};

export default MenuItem;
