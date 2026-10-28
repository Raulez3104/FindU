import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Search,
  Eye,
  Calendar,
  MapPin,
  User,
  Package,
  CheckCircle,
  Clock,
  XCircle,
  Tag,
  AlertCircle,
  Shield,
} from 'lucide-react';
import type { Reporte, EstadoReporte } from '../types/api';
import { listarReportes, obtenerReportePorId } from '../services/reportService';
import { ErrorApi, obtenerBaseUrl } from '../services/api';

const ESTADOS_VALIDOS: EstadoReporte[] = [
  'Perdido',
  'En servicios',
  'Devuelto',
  'Donado',
];

function getStatusColor(status: EstadoReporte): string {
  switch (status) {
    case 'Perdido':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'En servicios':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'Devuelto':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'Donado':
      return 'bg-teal-100 text-teal-800 border-teal-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getStatusIcon(status: EstadoReporte) {
  switch (status) {
    case 'Perdido':
      return <XCircle className="w-4 h-4 text-red-600" />;
    case 'En servicios':
      return <Shield className="w-4 h-4 text-purple-600" />;
    case 'Devuelto':
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    case 'Donado':
      return <Package className="w-4 h-4 text-teal-600" />;
    default:
      return <Clock className="w-4 h-4 text-gray-600" />;
  }
}

function resolverUrlImagen(imagen: string | null): string | null {
  if (!imagen || typeof imagen !== 'string') return null;
  if (/^https?:\/\//i.test(imagen)) return imagen;
  const baseUrl = obtenerBaseUrl();
  const conPrefijo = imagen.startsWith('/uploads/')
    ? imagen
    : imagen.startsWith('uploads/')
      ? `/${imagen}`
      : `/uploads/${imagen.replace(/^\/+/, '')}`;
  return `${baseUrl}${conPrefijo}`;
}

const ObjectsView: React.FC = () => {
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [filtroActivo, setFiltroActivo] = useState<string>('all');

  const [reporteSeleccionado, setReporteSeleccionado] = useState<Reporte | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  const cargarReportes = useCallback(async () => {
    setCargando(true);
    setError(null);

    try {
      const data = await listarReportes();
      setReportes(data);
    } catch (err) {
      if (err instanceof ErrorApi) {
        if (err.esNoAutorizado) {
          setError('No tienes permisos para visualizar el listado de reportes.');
        } else if (err.esNoAutenticado) {
          setError('Tu sesión ha expirado o no es válida.');
        } else {
          setError(err.message || 'Error al obtener los reportes.');
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocurrió un error inesperado al cargar los reportes.');
      }
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarReportes();
  }, [cargarReportes]);

  const abrirDetalle = async (id: number) => {
    setCargandoDetalle(true);
    setErrorDetalle(null);
    setReporteSeleccionado(null);

    try {
      const detalle = await obtenerReportePorId(id);
      setReporteSeleccionado(detalle);
    } catch (err) {
      if (err instanceof ErrorApi && err.esNoEncontrado) {
        setErrorDetalle('El reporte solicitado no existe o no fue encontrado.');
      } else if (err instanceof ErrorApi) {
        setErrorDetalle(err.message || 'Error al cargar el detalle del reporte.');
      } else if (err instanceof Error) {
        setErrorDetalle(err.message);
      } else {
        setErrorDetalle('Ocurrió un error inesperado al cargar el detalle.');
      }
    } finally {
      setCargandoDetalle(false);
    }
  };

  const reportesFiltrados = useMemo(() => {
    return reportes.filter((rep) => {
      if (statusFilter !== 'all' && rep.estado !== statusFilter) {
        return false;
      }

      if (filtroActivo === 'activos' && !rep.activo) {
        return false;
      }
      if (filtroActivo === 'archivados' && rep.activo) {
        return false;
      }

      if (searchTerm.trim() !== '') {
        const termino = searchTerm.toLowerCase();
        const coincideTitulo = rep.titulo.toLowerCase().includes(termino);
        const coincideUbicacion =
          (rep.ubicacion_nombre && rep.ubicacion_nombre.toLowerCase().includes(termino)) ||
          (rep.ubicacion_otro && rep.ubicacion_otro.toLowerCase().includes(termino)) ||
          rep.campus.toLowerCase().includes(termino);
        const coincideId = rep.id.toString().includes(termino);
        const coincideAutor =
          (rep.usuario_nombre && rep.usuario_nombre.toLowerCase().includes(termino)) ||
          (rep.administrador_nombre && rep.administrador_nombre.toLowerCase().includes(termino));

        if (!coincideTitulo && !coincideUbicacion && !coincideId && !coincideAutor) {
          return false;
        }
      }

      return true;
    });
  }, [reportes, statusFilter, filtroActivo, searchTerm]);

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando reportes administrativos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-lg font-bold text-red-800 mb-2">Error al cargar reportes</h2>
        <p className="text-red-700 text-sm mb-4">{error}</p>
        <button
          onClick={() => void cargarReportes()}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes de Objetos</h1>
          <p className="text-gray-600 text-sm mt-1">
            Consulta el listado administrativo completo de reportes activos y archivados
          </p>
        </div>
        <button
          onClick={() => void cargarReportes()}
          className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4 sm:space-y-0 sm:flex sm:items-center sm:gap-4">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por título, ubicación, autor o ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los estados</option>
            {ESTADOS_VALIDOS.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <select
            value={filtroActivo}
            onChange={(e) => setFiltroActivo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos (activos y archivados)</option>
            <option value="activos">Solo activos</option>
            <option value="archivados">Solo archivados</option>
          </select>
        </div>
      </div>

      {/* Tabla de reportes */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {reportesFiltrados.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-base font-medium">No se encontraron reportes</p>
            <p className="text-xs text-gray-400 mt-1">
              Prueba cambiando los filtros de búsqueda o el estado seleccionado
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 text-gray-700 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Objeto</th>
                  <th className="px-4 py-3">Tipo / Estado</th>
                  <th className="px-4 py-3">Ubicación</th>
                  <th className="px-4 py-3">Autor</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {reportesFiltrados.map((rep) => {
                  const ubicacion =
                    rep.ubicacion_nombre || rep.ubicacion_otro || rep.campus;
                  const autorNombre =
                    rep.tipo_autor === 'admin'
                      ? rep.administrador_nombre || 'Administrador'
                      : rep.usuario_nombre || 'Estudiante';
                  const autorCorreo =
                    rep.tipo_autor === 'admin' ? '' : rep.usuario_correo;

                  return (
                    <tr
                      key={rep.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        !rep.activo ? 'bg-gray-50/50' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 font-semibold">
                        #{rep.id}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {rep.imagen ? (
                            <img
                              src={resolverUrlImagen(rep.imagen) || ''}
                              alt={rep.titulo}
                              className="w-10 h-10 object-cover rounded border border-gray-200"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-gray-400">
                              <Package className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{rep.titulo}</p>
                            <p className="text-xs text-gray-500 truncate max-w-xs">
                              {rep.descripcion}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                              rep.estado,
                            )}`}
                          >
                            {getStatusIcon(rep.estado)}
                            {rep.estado}
                          </span>
                          <span className="text-[11px] text-gray-500 capitalize">
                            Tipo: {rep.tipo_reporte}
                          </span>
                          {!rep.activo && (
                            <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-medium">
                              Archivado
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-start gap-1 text-xs text-gray-700">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium">{ubicacion}</p>
                            <p className="text-[11px] text-gray-400">{rep.campus}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-xs">
                          <p className="font-medium text-gray-900">{autorNombre}</p>
                          {autorCorreo && (
                            <p className="text-[11px] text-gray-500">{autorCorreo}</p>
                          )}
                          <span className="text-[10px] text-gray-400 capitalize">
                            {rep.tipo_autor === 'admin' ? 'Personal administrativo' : 'Usuario'}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        <p>{rep.fecha || rep.fecha_incidente}</p>
                        <p className="text-[11px] text-gray-400">
                          Incidente: {rep.fecha_incidente}
                        </p>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => void abrirDetalle(rep.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-medium transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Ver
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Detalle (Solo Lectura) */}
      {(cargandoDetalle || errorDetalle || reporteSeleccionado) && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => {
            setReporteSeleccionado(null);
            setErrorDetalle(null);
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <h3 className="text-xl font-bold text-gray-900">
                  {reporteSeleccionado
                    ? `Detalle del Reporte #${reporteSeleccionado.id}`
                    : 'Detalle del Reporte'}
                </h3>
                <button
                  onClick={() => {
                    setReporteSeleccionado(null);
                    setErrorDetalle(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {cargandoDetalle && (
                <div className="py-12 text-center text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
                  <p className="text-sm">Consultando detalle en el servidor...</p>
                </div>
              )}

              {errorDetalle && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">No se pudo cargar el reporte</p>
                    <p className="text-xs mt-1">{errorDetalle}</p>
                  </div>
                </div>
              )}

              {reporteSeleccionado && (
                <div className="space-y-5 text-sm">
                  {reporteSeleccionado.imagen && (
                    <div className="bg-gray-50 rounded-lg p-2 border border-gray-200 text-center">
                      <img
                        src={resolverUrlImagen(reporteSeleccionado.imagen) || ''}
                        alt={reporteSeleccionado.titulo}
                        className="max-h-72 object-contain rounded mx-auto"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="block text-xs font-semibold text-gray-500 uppercase">
                        Título
                      </span>
                      <p className="text-base font-bold text-gray-900 mt-0.5">
                        {reporteSeleccionado.titulo}
                      </p>
                    </div>

                    <div>
                      <span className="block text-xs font-semibold text-gray-500 uppercase">
                        Estado Actual
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                            reporteSeleccionado.estado,
                          )}`}
                        >
                          {getStatusIcon(reporteSeleccionado.estado)}
                          {reporteSeleccionado.estado}
                        </span>
                        {!reporteSeleccionado.activo && (
                          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-medium">
                            Archivado
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <span className="block text-xs font-semibold text-gray-500 uppercase">
                        Descripción
                      </span>
                      <p className="text-gray-800 mt-1 whitespace-pre-wrap bg-gray-50 p-3 rounded border border-gray-100">
                        {reporteSeleccionado.descripcion || 'Sin descripción proporcionada'}
                      </p>
                    </div>

                    <div>
                      <span className="block text-xs font-semibold text-gray-500 uppercase">
                        Tipo de Reporte
                      </span>
                      <p className="text-gray-900 font-medium capitalize mt-0.5">
                        {reporteSeleccionado.tipo_reporte}
                      </p>
                    </div>

                    <div>
                      <span className="block text-xs font-semibold text-gray-500 uppercase">
                        Categoría
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5 text-gray-800">
                        <Tag className="w-4 h-4 text-gray-400" />
                        <span>{reporteSeleccionado.categoria_nombre || 'Sin categoría'}</span>
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-semibold text-gray-500 uppercase">
                        Ubicación
                      </span>
                      <div className="flex items-start gap-1.5 mt-0.5 text-gray-800">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">
                            {reporteSeleccionado.ubicacion_nombre ||
                              reporteSeleccionado.ubicacion_otro ||
                              'Ubicación no especificada'}
                          </p>
                          <p className="text-xs text-gray-500">
                            Campus: {reporteSeleccionado.campus}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-semibold text-gray-500 uppercase">
                        Contacto Proporcionado
                      </span>
                      <p className="text-gray-900 mt-0.5 font-medium">
                        {reporteSeleccionado.contacto || 'Sin contacto'}
                      </p>
                    </div>

                    <div>
                      <span className="block text-xs font-semibold text-gray-500 uppercase">
                        Autor del Reporte
                      </span>
                      <div className="flex items-start gap-1.5 mt-0.5 text-gray-800">
                        <User className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">
                            {reporteSeleccionado.tipo_autor === 'admin'
                              ? reporteSeleccionado.administrador_nombre || 'Administrador'
                              : reporteSeleccionado.usuario_nombre || 'Estudiante'}
                          </p>
                          {reporteSeleccionado.usuario_correo && (
                            <p className="text-xs text-gray-500">
                              {reporteSeleccionado.usuario_correo}
                            </p>
                          )}
                          <p className="text-[11px] text-gray-400 capitalize">
                            Tipo: {reporteSeleccionado.tipo_autor}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-semibold text-gray-500 uppercase">
                        Fechas de Registro
                      </span>
                      <div className="flex items-start gap-1.5 mt-0.5 text-gray-800">
                        <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                        <div className="text-xs">
                          <p>
                            Fecha incidente: <strong>{reporteSeleccionado.fecha_incidente}</strong>
                          </p>
                          <p className="text-gray-500">
                            Registro: {reporteSeleccionado.fecha}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex justify-end">
                    <button
                      onClick={() => setReporteSeleccionado(null)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ObjectsView;
