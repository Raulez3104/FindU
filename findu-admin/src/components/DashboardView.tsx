import React, { useEffect, useState, useCallback } from 'react';
import Card from './Card';
import Badge from './Badge';
import type { EstadisticasReportes, Reporte, EstadoReporte } from '../types/api';
import { listarReportes, obtenerEstadisticas } from '../services/reportService';
import { ErrorApi } from '../services/api';

function obtenerVarianteBadge(estado: EstadoReporte): 'exito' | 'advertencia' | 'peligro' | 'informacion' {
  switch (estado) {
    case 'Perdido':
      return 'peligro';
    case 'En servicios':
      return 'advertencia';
    case 'Devuelto':
      return 'exito';
    case 'Donado':
      return 'informacion';
    default:
      return 'informacion';
  }
}

const DashboardView: React.FC = () => {
  const [estadisticas, setEstadisticas] = useState<EstadisticasReportes | null>(null);
  const [actividadReciente, setActividadReciente] = useState<Reporte[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(null);

    try {
      const [statsData, reportesData] = await Promise.all([
        obtenerEstadisticas(),
        listarReportes(),
      ]);

      setEstadisticas(statsData);
      setActividadReciente(reportesData.slice(0, 5));
    } catch (err) {
      if (err instanceof ErrorApi) {
        if (err.esNoAutorizado) {
          setError('No tienes permisos para visualizar las estadísticas de este panel.');
        } else if (err.esNoAutenticado) {
          setError('Tu sesión ha expirado o no es válida.');
        } else {
          setError(err.message || 'Error al obtener los datos del panel.');
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocurrió un error inesperado al cargar el panel.');
      }
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  if (cargando) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-600">
        <p className="text-lg">Cargando panel de administración...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700">
        <h2 className="text-lg font-bold mb-2">Error al cargar el panel</h2>
        <p className="text-sm mb-4">{error}</p>
        <button
          onClick={() => void cargarDatos()}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const porEstado = estadisticas?.porEstado || {};

  const tarjetasResumen = [
    { titulo: 'Total de Reportes', valor: estadisticas?.total ?? 0, color: 'text-gray-900' },
    { titulo: 'Reportes Activos', valor: estadisticas?.activos ?? 0, color: 'text-blue-600' },
    { titulo: 'Reportes Archivados', valor: estadisticas?.inactivos ?? 0, color: 'text-gray-500' },
  ];

  const tarjetasEstados = [
    { titulo: 'Perdidos', valor: porEstado['Perdido'] ?? 0, color: 'text-red-600' },
    { titulo: 'En Servicios', valor: porEstado['En servicios'] ?? 0, color: 'text-purple-600' },
    { titulo: 'Devueltos', valor: porEstado['Devuelto'] ?? 0, color: 'text-green-600' },
    { titulo: 'Donados', valor: porEstado['Donado'] ?? 0, color: 'text-teal-600' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Resumen General</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {tarjetasResumen.map((item, idx) => (
            <Card key={idx}>
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-500">{item.titulo}</p>
                <p className={`text-3xl font-bold ${item.color}`}>{item.valor}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Reportes por Estado</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {tarjetasEstados.map((item, idx) => (
            <Card key={idx}>
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-500 truncate">{item.titulo}</p>
                <p className={`text-2xl font-bold ${item.color}`}>{item.valor}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <Card titulo="Actividad Reciente">
          {actividadReciente.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              No hay actividad reciente registrada en el sistema.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {actividadReciente.map((item) => {
                const ubicacionTexto =
                  item.ubicacion_nombre || item.ubicacion_otro || item.campus;
                const autorTexto =
                  item.tipo_autor === 'admin'
                    ? item.administrador_nombre || 'Administrador'
                    : item.usuario_nombre || 'Estudiante';

                return (
                  <div
                    key={item.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <p className="font-semibold text-gray-800">{item.titulo}</p>
                      <p className="text-xs text-gray-500">
                        {item.fecha} • {ubicacionTexto} • Autor: {autorTexto}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variante={obtenerVarianteBadge(item.estado)}>
                        {item.estado}
                      </Badge>
                      {!item.activo && (
                        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-medium">
                          Archivado
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default DashboardView;
