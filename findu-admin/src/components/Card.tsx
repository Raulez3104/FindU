import React from 'react';

interface CardProps {
  children?: React.ReactNode;
  titulo?: string;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, titulo, className = '' }) => {
  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      {titulo && (
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">{titulo}</h3>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};

export default Card;
