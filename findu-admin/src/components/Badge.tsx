import React from 'react';

type BadgeVariant = 'exito' | 'advertencia' | 'peligro' | 'informacion' | 'defecto';

interface BadgeProps {
  children?: React.ReactNode;
  variante?: BadgeVariant;
}

const Badge: React.FC<BadgeProps> = ({ children, variante = 'defecto' }) => {
  const clasesVariante = {
    exito: 'bg-green-100 text-green-800',
    advertencia: 'bg-yellow-100 text-yellow-800',
    peligro: 'bg-red-100 text-red-800',
    informacion: 'bg-blue-100 text-blue-800',
    defecto: 'bg-gray-100 text-gray-800',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${clasesVariante[variante]}`}>
      {children}
    </span>
  );
};

export default Badge;
