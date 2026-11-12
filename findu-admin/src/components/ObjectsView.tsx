import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  Compass,
  Plus,
  Loader2,
  History,
  Check,
  Edit3,
  Archive,
  RotateCcw,
  Gift,
  ArrowRightCircle,
} from 'lucide-react';
import type {
  Reporte,
  EstadoReporte,
  RespuestaTrazaReporte,
  DatosDevolucionReporte,
  RespuestaEdicionReporte,
  CandidatoCierreReporte,
} from '../types/api';
import {
  listarReportes,
  obtenerReportePorId,
  recepcionarReporte,
  devolverReporte,
  cerrarReportePerdido,
  donarReporte,
  archivarReporte,
  reactivarReporte,
  obtenerTrazaReporte,
  obtenerCandidatosCierre,
} from '../services/reportService';
import { ErrorApi, obtenerBaseUrl } from '../services/api';
import { restaurarSesion } from '../services/authService';
import FormularioReporteAdministrativo from './FormularioReporteAdministrativo';

const ESTADOS_VALIDOS: EstadoReporte[] = [
  'Perdido',
  'Encontrado',
  'En servicios',
  'Devuelto',
  'Donado',
];

function getStatusColor(status: EstadoReporte): string {
  switch (status) {
    case 'Perdido':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'Encontrado':
      return 'bg-amber-100 text-amber-800 border-amber-200';
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
    case 'Encontrado':
      return <Compass className="w-4 h-4 text-amber-600" />;
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

function formatearAccionTraza(accion: string): string {
  switch (accion) {
    case 'creacion':
      return 'Creación del reporte';
    case 'alta_reporte':
    case 'crear_reporte':
      return 'Reporte administrativo';
    case 'recepcion':
    case 'recepcion_reporte':
      return 'Recepción en servicios';
    case 'devolucion':
    case 'devolucion_reporte':
      return 'Devolución a propietario';
    case 'donacion':
    case 'donacion_reporte':
      return 'Donación institucional';
    case 'cierre':
    case 'cierre_perdido':
    case 'cierre_reporte':
      return 'Cierre por enlace';
    case 'archivo':
    case 'archivado':
    case 'archivo_reporte':
    case 'archivado_reporte':
      return 'Archivado administrativo';
    case 'reactivacion':
    case 'reactivacion_reporte':
      return 'Reactivación administrativa';
    case 'edicion':
    case 'edicion_reporte':
      return 'Edición de metadatos';
    default:
      return accion.replace(/_/g, ' ');
  }
}

interface ModalDevolucionProps {
  readonly reporte: Reporte;
  readonly enviando: boolean;
  readonly onSubmit: (datos: DatosDevolucionReporte) => Promise<void>;
  readonly onCancelar: () => void;
}

const ModalDevolucion: React.FC<ModalDevolucionProps> = ({
  reporte,
  enviando,
  onSubmit,
  onCancelar,
}) => {
  const [nombreReceptor, setNombreReceptor] = useState('');
  const [referenciaComprobante, setReferenciaComprobante] = useState('');
  const [observacion, setObservacion] = useState('');
  const [usuarioId, setUsuarioId] = useState('');
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal(null);

    const nom = nombreReceptor.trim();
    const ref = referenciaComprobante.trim();
    if (!nom) {
      setErrorLocal('El nombre del receptor es requerido.');
      return;
    }
    if (!ref) {
      setErrorLocal('La descripción del comprobante o verificación es requerida.');
      return;
    }

    let usuarioIdNum: number | undefined;
    if (usuarioId.trim()) {
      if (!/^[1-9]\d*$/.test(usuarioId.trim())) {
        setErrorLocal('El ID de usuario debe ser un número entero positivo.');
        return;
      }
      usuarioIdNum = Number(usuarioId.trim());
      if (!Number.isSafeInteger(usuarioIdNum) || usuarioIdNum > 2147483647) {
        setErrorLocal('El ID de usuario excede el rango admitido.');
        return;
      }
    }

    await onSubmit({
      nombre_receptor: nom,
      referencia_comprobante: ref,
      observacion: observacion.trim() || undefined,
      usuario_id: usuarioIdNum,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto"
      onClick={onCancelar}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Devolución a Propietario — #{reporte.id}
          </h2>
          <button
            onClick={onCancelar}
            className="text-gray-400 hover:text-gray-600 p-1 rounded"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {errorLocal && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{errorLocal}</span>
          </div>
        )}

        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800 mb-4">
          <p className="font-semibold">Verificación Institucional de Devolución (A10)</p>
          <p className="mt-0.5 text-green-700">
            Registre los datos de entrega física. La información del receptor queda almacenada de forma minimizada y auditada en el expediente.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Nombre del Receptor <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={255}
              value={nombreReceptor}
              onChange={(e) => setNombreReceptor(e.target.value)}
              placeholder="Ej. Persona receptora ficticia"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              disabled={enviando}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Descripción del Comprobante o Verificación{' '}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={255}
              value={referenciaComprobante}
              onChange={(e) => setReferenciaComprobante(e.target.value)}
              placeholder="Ej. Descripción coincidente del contenido del objeto"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              disabled={enviando}
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Describa solo el tipo de comprobante presentado o la verificación presencial. No escriba números de documento, acta, folio o identificadores ni adjunte fotografías de carnet.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              ID de Usuario Estudiante (Opcional)
            </label>
            <input
              type="text"
              value={usuarioId}
              onChange={(e) => setUsuarioId(e.target.value)}
              placeholder="Ej. 145"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              disabled={enviando}
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Solo si el receptor es un estudiante registrado en FindU.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Observaciones / Detalles de la Entrega (Opcional)
            </label>
            <textarea
              rows={2}
              maxLength={1000}
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Ej. Detalle ficticio de la verificación o entrega"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
              disabled={enviando}
            />
          </div>

          <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancelar}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              disabled={enviando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              disabled={enviando}
            >
              {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
              {enviando ? 'Registrando entrega...' : 'Confirmar Devolución'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ModalConfirmacionRecepcionProps {
  readonly reporte: Reporte;
  readonly enviando: boolean;
  readonly onConfirmar: () => Promise<void>;
  readonly onCancelar: () => void;
}

const ModalConfirmacionRecepcion: React.FC<ModalConfirmacionRecepcionProps> = ({
  reporte,
  enviando,
  onConfirmar,
  onCancelar,
}) => {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto"
      onClick={onCancelar}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-600" />
            Confirmar Recepción en Servicios — #{reporte.id}
          </h2>
          <button
            onClick={onCancelar}
            disabled={enviando}
            className="text-gray-400 hover:text-gray-600 p-1 rounded disabled:opacity-50"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-800 mb-4">
          <p className="font-semibold">Confirmación previa de recepción institucional (A14)</p>
          <p className="mt-0.5 text-purple-700">
            Verifique los datos del hallazgo antes de ingresarlo a custodia institucional («En servicios»).
          </p>
        </div>

        <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200 text-xs">
          <div className="flex gap-4">
            {resolverUrlImagen(reporte.imagen) ? (
              <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-200 shrink-0 border border-gray-300">
                <img
                  src={resolverUrlImagen(reporte.imagen) ?? ''}
                  alt={reporte.titulo}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-lg bg-gray-200 shrink-0 flex items-center justify-center text-gray-400 border border-gray-300">
                <Package className="w-8 h-8" />
              </div>
            )}
            <div className="space-y-1.5 flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{reporte.titulo}</p>
              <p className="text-gray-600">
                <span className="font-semibold text-gray-700">ID:</span> #{reporte.id}
              </p>
              <p className="text-gray-600">
                <span className="font-semibold text-gray-700">Tipo / Estado:</span>{' '}
                <span className="capitalize">{reporte.tipo_reporte}</span> —{' '}
                <span className="font-semibold text-purple-700">{reporte.estado}</span>
              </p>
              <p className="text-gray-600">
                <span className="font-semibold text-gray-700">Fecha:</span> {reporte.fecha}
              </p>
              <p className="text-gray-600 truncate">
                <span className="font-semibold text-gray-700">Ubicación:</span>{' '}
                {reporte.ubicacion_nombre || reporte.ubicacion_otro || 'No especificada'} ({reporte.campus})
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 mt-5">
          <button
            type="button"
            onClick={onCancelar}
            disabled={enviando}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void onConfirmar()}
            disabled={enviando}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 shadow-xs"
          >
            {enviando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirmar Recepción
          </button>
        </div>
      </div>
    </div>
  );
};

interface ModalSelectorCierreProps {
  readonly reportePerdido: Reporte;
  readonly enviando: boolean;
  readonly onConfirmarCierre: (reporteEncontradoId: number) => Promise<void>;
  readonly onCancelar: () => void;
}

const requiereRefrescoDeCandidatos = (error: ErrorApi): boolean =>
  error.esConflicto && [
    'El reporte ya se encuentra vinculado a otra contraparte',
    'La contraparte seleccionada ya fue utilizada para cerrar otro reporte',
  ].includes(error.message);

const ModalSelectorCierre: React.FC<ModalSelectorCierreProps> = ({
  reportePerdido,
  enviando,
  onConfirmarCierre,
  onCancelar,
}) => {
  const [busqueda, setBusqueda] = useState('');
  const [candidatos, setCandidatos] = useState<readonly CandidatoCierreReporte[]>([]);
  const [cargando, setCargando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [candidatoSeleccionado, setCandidatoSeleccionado] = useState<CandidatoCierreReporte | null>(null);
  const confirmandoRef = useRef(false);

  const cargarCandidatos = useCallback(async (
    terminoBusqueda: string,
    errorPrincipal?: string,
  ): Promise<readonly CandidatoCierreReporte[] | null> => {
    setCargando(true);
    setErrorLocal(errorPrincipal ?? null);
    try {
      const data = await obtenerCandidatosCierre(reportePerdido.id, terminoBusqueda);
      setCandidatos(data);
      return data;
    } catch (err) {
      const mensajeRefresco = err instanceof ErrorApi
        ? err.message
        : 'Error al consultar candidatos de entrega.';
      setErrorLocal(
        errorPrincipal
          ? `${errorPrincipal} Además, no fue posible actualizar los candidatos: ${mensajeRefresco}`
          : mensajeRefresco,
      );
      return null;
    } finally {
      setCargando(false);
    }
  }, [reportePerdido.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void cargarCandidatos(busqueda);
    }, 250);
    return () => clearTimeout(timer);
  }, [busqueda, cargarCandidatos]);

  const handleConfirmar = async () => {
    if (!candidatoSeleccionado || enviando || confirmandoRef.current) return;
    confirmandoRef.current = true;
    setErrorLocal(null);
    try {
      await onConfirmarCierre(candidatoSeleccionado.id);
    } catch (err) {
      if (err instanceof ErrorApi) {
        const mensajePrincipal = err.message;
        setErrorLocal(mensajePrincipal);

        if (requiereRefrescoDeCandidatos(err)) {
          const candidatosActualizados = await cargarCandidatos(busqueda, mensajePrincipal);
          if (candidatosActualizados) {
            const candidatoActualizado = candidatosActualizados.find(
              (candidato) => candidato.id === candidatoSeleccionado.id,
            );
            setCandidatoSeleccionado(
              candidatoActualizado && !candidatoActualizado.usado
                ? candidatoActualizado
                : null,
            );
          }
        }
      } else if (err instanceof Error) {
        setErrorLocal(err.message);
      } else {
        setErrorLocal('No fue posible cerrar el reporte.');
      }
    } finally {
      confirmandoRef.current = false;
    }
  };

  const cancelarSiDisponible = () => {
    if (!enviando && !confirmandoRef.current) onCancelar();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto"
      onClick={cancelarSiDisponible}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4 shrink-0">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ArrowRightCircle className="w-5 h-5 text-blue-600" />
            Cierre por Enlace — Perdido #{reportePerdido.id}
          </h2>
          <button
            onClick={cancelarSiDisponible}
            disabled={enviando}
            className="text-gray-400 hover:text-gray-600 p-1 rounded disabled:opacity-50"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {errorLocal && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2 shrink-0">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{errorLocal}</span>
          </div>
        )}

        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 mb-4 shrink-0">
          <p className="font-semibold">Cierre administrativo con contraparte 1:1 (A13)</p>
          <p className="mt-0.5 text-blue-700">
            Seleccione el reporte de objeto encontrado ya entregado a su propietario (con verificación física A10) al cual corresponde este reporte perdido.
          </p>
        </div>

        {/* Buscador de candidatos */}
        <div className="relative mb-3 shrink-0">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar candidato por título o ID exacto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-900 placeholder:text-gray-500 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Lista de candidatos */}
        <div className="flex-1 overflow-y-auto min-h-48 max-h-60 border border-gray-200 rounded-lg p-2 space-y-2 mb-4 bg-gray-50/50">
          {cargando ? (
            <div className="py-8 text-center text-xs text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-gray-400" />
              Buscando candidatos devueltos con verificación A10...
            </div>
          ) : candidatos.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-500">
              <Package className="w-8 h-8 text-gray-300 mx-auto mb-1" />
              No se encontraron hallazgos devueltos elegibles con verificación A10.
            </div>
          ) : (
            candidatos.map((cand) => {
              const esSeleccionado = candidatoSeleccionado?.id === cand.id;
              const noSeleccionable = cand.usado;
              return (
                <div
                  key={cand.id}
                  onClick={() => {
                    if (!noSeleccionable) {
                      setCandidatoSeleccionado(cand);
                    }
                  }}
                  className={`p-3 rounded-lg border transition-all text-xs flex items-center justify-between gap-3 ${
                    noSeleccionable
                      ? 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed'
                      : esSeleccionado
                        ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-300 cursor-pointer'
                        : 'bg-white border-gray-200 hover:border-blue-300 cursor-pointer'
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 truncate">
                        #{cand.id} — {cand.titulo}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-800">
                        {cand.estado}
                      </span>
                      {cand.archivado && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                          Archivado
                        </span>
                      )}
                      {cand.usado && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-800">
                          Ya enlazado (1:1)
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 flex items-center gap-4 flex-wrap">
                      <span><strong>Fecha:</strong> {cand.fecha}</span>
                      <span><strong>Campus:</strong> {cand.campus}</span>
                      {cand.ubicacion && <span><strong>Ubicación:</strong> {cand.ubicacion}</span>}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {noSeleccionable ? (
                      <span className="text-[10px] text-gray-400 italic">No disponible</span>
                    ) : esSeleccionado ? (
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Tarjeta de Comparación (V4-T16) */}
        {candidatoSeleccionado && (
          <div className="shrink-0 p-3 bg-white rounded-lg border-2 border-blue-200 shadow-xs mb-4 space-y-2">
            <p className="text-xs font-bold text-gray-900 uppercase tracking-wide">
              Comparación de Enlace (A13/A14)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-amber-50/60 rounded border border-amber-200 space-y-1">
                <p className="font-semibold text-amber-900">Reporte Perdido Actual</p>
                <p className="text-gray-800 font-medium">#{reportePerdido.id} — {reportePerdido.titulo}</p>
                <p className="text-gray-600 text-[11px]">Estado: <span className="text-amber-800 font-semibold">{reportePerdido.estado}</span></p>
                <p className="text-gray-600 text-[11px]">Fecha: {reportePerdido.fecha}</p>
                <p className="text-gray-600 text-[11px]">Ubicación: {reportePerdido.ubicacion_nombre || reportePerdido.ubicacion_otro || 'N/A'} ({reportePerdido.campus})</p>
              </div>

              <div className="p-2.5 bg-green-50/60 rounded border border-green-200 space-y-1">
                <p className="font-semibold text-green-900">Contraparte Encontrada</p>
                <p className="text-gray-800 font-medium">#{candidatoSeleccionado.id} — {candidatoSeleccionado.titulo}</p>
                <p className="text-gray-600 text-[11px]">Estado: <span className="text-green-800 font-semibold">{candidatoSeleccionado.estado}</span></p>
                <p className="text-gray-600 text-[11px]">Fecha: {candidatoSeleccionado.fecha}</p>
                <p className="text-gray-600 text-[11px]">Ubicación: {candidatoSeleccionado.ubicacion || 'N/A'} ({candidatoSeleccionado.campus})</p>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 italic text-center">
              Al confirmar, el reporte perdido quedará enlazado 1:1 a la entrega del hallazgo #{candidatoSeleccionado.id} y pasará a estado «Devuelto».
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={cancelarSiDisponible}
            disabled={enviando}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleConfirmar()}
            disabled={enviando || !candidatoSeleccionado}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 shadow-xs"
          >
            {enviando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirmar Cierre de Reporte
          </button>
        </div>
      </div>
    </div>
  );
};

const ObjectsView: React.FC = () => {
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [filtroActivo, setFiltroActivo] = useState<string>('all');

  const [reporteSeleccionado, setReporteSeleccionado] = useState<Reporte | null>(null);
  const reporteSeleccionadoRef = useRef<Reporte | null>(null);
  const versionSeleccionDetalleRef = useRef(0);
  const versionListadoRef = useRef(0);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  const [traza, setTraza] = useState<RespuestaTrazaReporte | null>(null);
  const [cargandoTraza, setCargandoTraza] = useState(false);
  const [errorTraza, setErrorTraza] = useState<string | null>(null);

  const [mostrarModalAlta, setMostrarModalAlta] = useState(false);
  const [reporteParaEditar, setReporteParaEditar] = useState<Reporte | null>(null);
  const [reporteParaDevolver, setReporteParaDevolver] = useState<Reporte | null>(null);
  const [reporteParaRecepcionar, setReporteParaRecepcionar] = useState<Reporte | null>(null);
  const [reporteParaCerrar, setReporteParaCerrar] = useState<Reporte | null>(null);
  const [operandoId, setOperandoId] = useState<number | null>(null);

  const [mensajeFeedback, setMensajeFeedback] = useState<{
    tipo: 'exito' | 'advertencia' | 'error';
    texto: string;
  } | null>(null);

  const sesion = useMemo(() => restaurarSesion(Date.now()), []);
  const rol = sesion?.administrador?.rol;
  const puedeMutar = rol === 'admin' || rol === 'personal_servicios';
  const esAdmin = rol === 'admin';

  const cargarReportes = useCallback(async (
    mostrarErrorPrincipal = true,
  ): Promise<string | null> => {
    const versionSolicitud = ++versionListadoRef.current;
    setCargando(true);
    if (mostrarErrorPrincipal) setError(null);

    try {
      const data = await listarReportes();
      if (versionSolicitud === versionListadoRef.current) {
        setReportes(data);
      }
      return null;
    } catch (err) {
      let mensaje: string;
      if (err instanceof ErrorApi) {
        if (err.esNoAutorizado) {
          mensaje = 'No tienes permisos para visualizar el listado de reportes.';
        } else if (err.esNoAutenticado) {
          mensaje = 'Tu sesión ha expirado o no es válida.';
        } else {
          mensaje = err.message || 'Error al obtener los reportes.';
        }
      } else if (err instanceof Error) {
        mensaje = err.message;
      } else {
        mensaje = 'Ocurrió un error inesperado al consultar los reportes.';
      }
      if (mostrarErrorPrincipal && versionSolicitud === versionListadoRef.current) {
        setError(mensaje);
      }
      return mensaje;
    } finally {
      if (versionSolicitud === versionListadoRef.current) {
        setCargando(false);
      }
    }
  }, []);

  useEffect(() => {
    void cargarReportes();
  }, [cargarReportes]);

  const cargarTraza = useCallback(async (
    id: number,
    versionSeleccion = versionSeleccionDetalleRef.current,
  ): Promise<string | null> => {
    setCargandoTraza(true);
    setErrorTraza(null);

    try {
      const datosTraza = await obtenerTrazaReporte(id);
      if (
        versionSeleccion === versionSeleccionDetalleRef.current &&
        reporteSeleccionadoRef.current?.id === id
      ) {
        setTraza(datosTraza);
      }
      return null;
    } catch (err) {
      let mensaje: string;
      if (err instanceof ErrorApi) {
        mensaje = err.message || 'Error al obtener el historial de traza.';
      } else if (err instanceof Error) {
        mensaje = err.message;
      } else {
        mensaje = 'No fue posible cargar el historial de auditoría.';
      }
      if (
        versionSeleccion === versionSeleccionDetalleRef.current &&
        reporteSeleccionadoRef.current?.id === id
      ) {
        setErrorTraza(mensaje);
      }
      return mensaje;
    } finally {
      if (versionSeleccion === versionSeleccionDetalleRef.current) {
        setCargandoTraza(false);
      }
    }
  }, []);

  const cerrarDetalle = useCallback(() => {
    versionSeleccionDetalleRef.current += 1;
    reporteSeleccionadoRef.current = null;
    setReporteSeleccionado(null);
    setCargandoDetalle(false);
    setCargandoTraza(false);
    setErrorDetalle(null);
    setTraza(null);
    setErrorTraza(null);
  }, []);

  const abrirDetalle = async (id: number) => {
    const versionSeleccion = ++versionSeleccionDetalleRef.current;
    setCargandoDetalle(true);
    setErrorDetalle(null);
    setTraza(null);

    try {
      const rep = await obtenerReportePorId(id);
      if (versionSeleccion !== versionSeleccionDetalleRef.current) return;
      reporteSeleccionadoRef.current = rep;
      setReporteSeleccionado(rep);
      void cargarTraza(id, versionSeleccion);
    } catch (err) {
      if (versionSeleccion !== versionSeleccionDetalleRef.current) return;
      if (err instanceof ErrorApi) {
        if (err.esNoEncontrado) {
          setErrorDetalle('El reporte solicitado no existe.');
        } else if (err.esNoAutorizado) {
          setErrorDetalle('No tienes permisos para ver el detalle de este reporte.');
        } else {
          setErrorDetalle(err.message || 'Error al cargar el detalle del reporte.');
        }
      } else if (err instanceof Error) {
        setErrorDetalle(err.message);
      } else {
        setErrorDetalle('Error inesperado al consultar el reporte.');
      }
    } finally {
      if (versionSeleccion === versionSeleccionDetalleRef.current) {
        setCargandoDetalle(false);
      }
    }
  };

  const recargarVistasTrasMutacion = async (id: number): Promise<readonly string[]> => {
    const versionSeleccion = versionSeleccionDetalleRef.current;
    const detalleAbierto = reporteSeleccionadoRef.current?.id === id;

    const recargarDetalle = async (): Promise<string | null> => {
      if (!detalleAbierto) return null;
      try {
        const detalle = await obtenerReportePorId(id);
        if (
          versionSeleccion === versionSeleccionDetalleRef.current &&
          reporteSeleccionadoRef.current?.id === id
        ) {
          reporteSeleccionadoRef.current = detalle;
          setReporteSeleccionado(detalle);
          setErrorDetalle(null);
        }
        return null;
      } catch (err) {
        const mensaje = err instanceof ErrorApi || err instanceof Error
          ? err.message
          : 'Error inesperado al actualizar el detalle.';
        if (
          versionSeleccion === versionSeleccionDetalleRef.current &&
          reporteSeleccionadoRef.current?.id === id
        ) {
          setErrorDetalle(
            `La operación fue confirmada, pero el detalle no pudo actualizarse: ${mensaje}`,
          );
        }
        return mensaje;
      }
    };

    const [errorListado, errorDetalleActualizado, errorTrazaActualizada] = await Promise.all([
      cargarReportes(false),
      recargarDetalle(),
      detalleAbierto ? cargarTraza(id, versionSeleccion) : Promise.resolve(null),
    ]);

    const fallos: string[] = [];
    if (errorListado) fallos.push(`listado (${errorListado})`);
    if (errorDetalleActualizado) fallos.push(`detalle (${errorDetalleActualizado})`);
    if (errorTrazaActualizada) fallos.push(`traza (${errorTrazaActualizada})`);
    return fallos;
  };

  const informarOperacionConfirmada = (
    textoConfirmacion: string,
    fallosRefresco: readonly string[],
  ) => {
    if (fallosRefresco.length === 0) {
      setMensajeFeedback({ tipo: 'exito', texto: textoConfirmacion });
      return;
    }
    setMensajeFeedback({
      tipo: 'advertencia',
      texto: `${textoConfirmacion} Sin embargo, no fue posible acreditar la actualización de ${fallosRefresco.join(', ')}. Los datos conservados pueden estar desactualizados; vuelva a cargar antes de continuar.`,
    });
  };

  const manejarErrorOperacion = (err: unknown, accion: string) => {
    if (err instanceof ErrorApi) {
      if (err.esConflicto) {
        setMensajeFeedback({
          tipo: 'error',
          texto: `Conflicto al ${accion}: el reporte se encuentra archivado o en un estado incompatible.`,
        });
      } else if (err.esNoAutorizado) {
        setMensajeFeedback({
          tipo: 'error',
          texto: `No tienes autorización para ${accion} este reporte.`,
        });
      } else if (err.esNoAutenticado) {
        setMensajeFeedback({
          tipo: 'error',
          texto: 'Tu sesión ha expirado.',
        });
      } else if (err.esPeticionInvalida) {
        setMensajeFeedback({
          tipo: 'error',
          texto: err.message || `Datos inválidos para ${accion}.`,
        });
      } else {
        setMensajeFeedback({
          tipo: 'error',
          texto: err.message || `Error al ${accion} el reporte.`,
        });
      }
    } else if (err instanceof Error) {
      setMensajeFeedback({ tipo: 'error', texto: err.message });
    } else {
      setMensajeFeedback({
        tipo: 'error',
        texto: `Ocurrió un error inesperado al ${accion} el reporte.`,
      });
    }
  };

  const handleRecepcionar = async (id: number) => {
    if (!puedeMutar || operandoId === id) return;
    setOperandoId(id);
    setMensajeFeedback(null);

    try {
      const res = await recepcionarReporte(id);
      const texto = !res.cambiado
        ? `El servidor confirmó que la recepción del reporte #${id} no produjo cambios.`
        : `El servidor confirmó la recepción del reporte #${id}.`;

      setReporteParaRecepcionar(null);
      const fallosRefresco = await recargarVistasTrasMutacion(id);
      informarOperacionConfirmada(texto, fallosRefresco);
    } catch (err) {
      manejarErrorOperacion(err, 'recepcionar');
    } finally {
      setOperandoId(null);
    }
  };

  const handleConfirmarDevolucion = async (datos: DatosDevolucionReporte) => {
    if (!reporteParaDevolver) return;
    const id = reporteParaDevolver.id;
    setOperandoId(id);
    setMensajeFeedback(null);

    try {
      const res = await devolverReporte(id, datos);
      const texto = res.cambiado
        ? `Reporte #${id} devuelto exitosamente a ${datos.nombre_receptor}.`
        : `El reporte #${id} ya se encontraba registrado como devuelto.`;

      setMensajeFeedback({ tipo: 'exito', texto });
      setReporteParaDevolver(null);

      await cargarReportes();

      if (reporteSeleccionado && reporteSeleccionado.id === id) {
        setReporteSeleccionado((prev) =>
          prev ? { ...prev, estado: 'Devuelto' } : null,
        );
        void cargarTraza(id);
      }
    } catch (err) {
      manejarErrorOperacion(err, 'devolver');
    } finally {
      setOperandoId(null);
    }
  };

  const handleCerrarPerdido = async (id: number, reporteEncontradoId: number) => {
    if (!puedeMutar || operandoId === id) return;
    setOperandoId(id);
    setMensajeFeedback(null);

    try {
      const res = await cerrarReportePerdido(id, { reporte_encontrado_id: reporteEncontradoId });
      const texto = res.cambiado
        ? `El servidor confirmó el cierre del reporte #${id} con el hallazgo #${reporteEncontradoId}.`
        : `El servidor confirmó que el cierre del reporte #${id} no produjo cambios.`;

      setReporteParaCerrar(null);
      const fallosRefresco = await recargarVistasTrasMutacion(id);
      informarOperacionConfirmada(texto, fallosRefresco);
    } finally {
      setOperandoId(null);
    }
  };

  const handleDonar = async (id: number) => {
    if (!esAdmin || operandoId === id) return;
    setOperandoId(id);
    setMensajeFeedback(null);

    try {
      const res = await donarReporte(id);
      const texto = res.cambiado
        ? `Reporte #${id} asignado a donación institucional exitosamente.`
        : `El reporte #${id} ya se encontraba registrado como donado.`;

      setMensajeFeedback({ tipo: 'exito', texto });

      setReportes((prev) =>
        prev.map((r) => (r.id === id ? { ...r, estado: 'Donado' } : r)),
      );

      if (reporteSeleccionado && reporteSeleccionado.id === id) {
        setReporteSeleccionado((prev) =>
          prev ? { ...prev, estado: 'Donado' } : null,
        );
        void cargarTraza(id);
      }
    } catch (err) {
      manejarErrorOperacion(err, 'donar');
    } finally {
      setOperandoId(null);
    }
  };

  const handleArchivar = async (id: number) => {
    if (!puedeMutar || operandoId === id) return;
    setOperandoId(id);
    setMensajeFeedback(null);

    try {
      const res = await archivarReporte(id);
      const texto = res.cambiado
        ? `Reporte #${id} archivado exitosamente.`
        : `El reporte #${id} ya se encontraba archivado.`;

      setMensajeFeedback({ tipo: 'exito', texto });

      setReportes((prev) =>
        prev.map((r) => (r.id === id ? { ...r, activo: false } : r)),
      );

      if (reporteSeleccionado && reporteSeleccionado.id === id) {
        setReporteSeleccionado((prev) =>
          prev ? { ...prev, activo: false } : null,
        );
        void cargarTraza(id);
      }
    } catch (err) {
      manejarErrorOperacion(err, 'archivar');
    } finally {
      setOperandoId(null);
    }
  };

  const handleReactivar = async (id: number) => {
    if (!puedeMutar || operandoId === id) return;
    setOperandoId(id);
    setMensajeFeedback(null);

    try {
      const res = await reactivarReporte(id);
      const texto = res.cambiado
        ? `Reporte #${id} reactivado exitosamente.`
        : `El reporte #${id} ya se encontraba activo.`;

      setMensajeFeedback({ tipo: 'exito', texto });

      setReportes((prev) =>
        prev.map((r) => (r.id === id ? { ...r, activo: true } : r)),
      );

      if (reporteSeleccionado && reporteSeleccionado.id === id) {
        setReporteSeleccionado((prev) =>
          prev ? { ...prev, activo: true } : null,
        );
        void cargarTraza(id);
      }
    } catch (err) {
      manejarErrorOperacion(err, 'reactivar');
    } finally {
      setOperandoId(null);
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
          (rep.administrador_nombre &&
            rep.administrador_nombre.toLowerCase().includes(termino));

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
      {/* Banner de Feedback Operativo */}
      {mensajeFeedback && (
        <div
          className={`p-4 rounded-lg text-sm flex items-start justify-between gap-3 border ${
            mensajeFeedback.tipo === 'exito'
              ? 'bg-green-50 border-green-200 text-green-800'
              : mensajeFeedback.tipo === 'advertencia'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-start gap-2">
            {mensajeFeedback.tipo === 'exito' ? (
              <Check className="w-5 h-5 shrink-0 text-green-600 mt-0.5" />
            ) : (
              <AlertCircle
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  mensajeFeedback.tipo === 'advertencia' ? 'text-amber-600' : 'text-red-600'
                }`}
              />
            )}
            <span>{mensajeFeedback.texto}</span>
          </div>
          <button
            onClick={() => setMensajeFeedback(null)}
            className="text-gray-400 hover:text-gray-600 text-xs font-semibold"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Header con botón de Alta Administrativa */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes de Objetos</h1>
          <p className="text-gray-600 text-sm mt-1">
            Gestión administrativa de los 5 estados institucionales y trazabilidad auditada
          </p>
        </div>

        {puedeMutar && (
          <button
            onClick={() => setMostrarModalAlta(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#fb8500] hover:bg-[#e07500] text-white rounded-lg text-sm font-semibold transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Reporte Administrativo
          </button>
        )}
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar por título, ubicación, autor o ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 bg-white focus:ring-2 focus:ring-[#fb8500] focus:border-transparent outline-none"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-[#fb8500] focus:border-transparent outline-none"
            >
              <option value="all">Todos los estados (5)</option>
              {ESTADOS_VALIDOS.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filtroActivo}
              onChange={(e) => setFiltroActivo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-[#fb8500] focus:border-transparent outline-none"
            >
              <option value="all">Todos los registros (activos y archivados)</option>
              <option value="activos">Solo activos</option>
              <option value="archivados">Solo archivados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Listado de Reportes */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
        {reportesFiltrados.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">No se encontraron reportes</p>
            <p className="text-xs text-gray-600 mt-1">
              Prueba cambiando los filtros de búsqueda o registra un nuevo reporte administrativo.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="px-4 py-3">ID / Título</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Ubicación / Campus</th>
                  <th className="px-4 py-3">Autor</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reportesFiltrados.map((rep) => {
                  const urlFoto = resolverUrlImagen(rep.imagen);
                  const ubicacion =
                    rep.ubicacion_nombre || rep.ubicacion_otro || 'Ubicación no especificada';
                  const autorNombre =
                    rep.tipo_autor === 'admin'
                      ? rep.administrador_nombre || 'Administrador'
                      : rep.usuario_nombre || 'Estudiante';
                  const autorCorreo =
                    rep.tipo_autor === 'admin' ? '' : rep.usuario_correo;

                  const puedeRecepcionar =
                    rep.estado === 'Encontrado' && rep.activo && puedeMutar;
                  const puedeDevolver =
                    rep.estado === 'En servicios' && rep.activo && puedeMutar;
                  const puedeCerrar =
                    rep.estado === 'Perdido' && rep.activo && puedeMutar;
                  const puedeDonar =
                    rep.estado === 'En servicios' && rep.activo && esAdmin;
                  const puedeEditar =
                    rep.activo &&
                    rep.estado !== 'Devuelto' &&
                    rep.estado !== 'Donado' &&
                    puedeMutar;
                  const puedeArchivar = rep.activo && puedeMutar;
                  const puedeReactivar = !rep.activo && puedeMutar;

                  const estaOperando = operandoId === rep.id;

                  return (
                    <tr key={rep.id} className="hover:bg-gray-50/75 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {urlFoto ? (
                            <img
                              src={urlFoto}
                              alt={rep.titulo}
                              className="w-10 h-10 rounded object-cover border border-gray-200 shrink-0 bg-gray-50"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 text-gray-400">
                              <Package className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-gray-900 text-sm line-clamp-1">
                              {rep.titulo}
                            </p>
                            <p className="text-xs text-gray-500 font-mono">
                              #{rep.id} · Cat: {rep.categoria_nombre || 'General'}
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
                            <p className="text-[11px] text-gray-600">{rep.campus}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-xs">
                          <p className="font-medium text-gray-900">{autorNombre}</p>
                          {autorCorreo && (
                            <p className="text-[11px] text-gray-500">{autorCorreo}</p>
                          )}
                          <span className="text-[10px] text-gray-600 capitalize">
                            {rep.tipo_autor === 'admin' ? 'Personal administrativo' : 'Usuario'}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        <p>{rep.fecha || rep.fecha_incidente}</p>
                        <p className="text-[11px] text-gray-600">
                          Incidente: {rep.fecha_incidente}
                        </p>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                          {puedeRecepcionar && (
                            <button
                              onClick={() => setReporteParaRecepcionar(rep)}
                              disabled={estaOperando}
                              title="Poner objeto en custodia institucional (confirmación A14)"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              {estaOperando ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Shield className="w-3.5 h-3.5" />
                              )}
                              Recepcionar
                            </button>
                          )}

                          {puedeDevolver && (
                            <button
                              onClick={() => setReporteParaDevolver(rep)}
                              disabled={estaOperando}
                              title="Devolver a propietario con verificación A10"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Devolver
                            </button>
                          )}

                          {puedeCerrar && (
                            <button
                              onClick={() => setReporteParaCerrar(rep)}
                              disabled={estaOperando}
                              title="Cerrar reporte perdido mediante enlace con entrega A10"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              {estaOperando ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <ArrowRightCircle className="w-3.5 h-3.5" />
                              )}
                              Cerrar
                            </button>
                          )}

                          {puedeDonar && (
                            <button
                              onClick={() => void handleDonar(rep.id)}
                              disabled={estaOperando}
                              title="Donación institucional exclusiva para administrador"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-100 rounded text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              {estaOperando ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Gift className="w-3.5 h-3.5" />
                              )}
                              Donar
                            </button>
                          )}

                          {puedeEditar && (
                            <button
                              onClick={() => setReporteParaEditar(rep)}
                              disabled={estaOperando}
                              title="Editar metadatos institucionales"
                              className="inline-flex items-center gap-1 px-2 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {puedeArchivar && (
                            <button
                              onClick={() => void handleArchivar(rep.id)}
                              disabled={estaOperando}
                              title="Archivar reporte"
                              className="inline-flex items-center gap-1 px-2 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {puedeReactivar && (
                            <button
                              onClick={() => void handleReactivar(rep.id)}
                              disabled={estaOperando}
                              title="Reactivar reporte archivado"
                              className="inline-flex items-center gap-1 px-2 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => void abrirDetalle(rep.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-medium transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Ver
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Alta Administrativa */}
      {mostrarModalAlta && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto"
          onClick={() => setMostrarModalAlta(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#fb8500]" />
                Reporte Administrativo de Objeto Encontrado
              </h2>
              <button
                onClick={() => setMostrarModalAlta(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <FormularioReporteAdministrativo
              onExito={(nuevo) => {
                setMostrarModalAlta(false);
                setMensajeFeedback({
                  tipo: 'exito',
                  texto: `Reporte #${nuevo.id} creado exitosamente en estado «En servicios».`,
                });
                void cargarReportes();
              }}
              onCancelar={() => setMostrarModalAlta(false)}
            />
          </div>
        </div>
      )}

      {/* Modal de Edición de Metadatos */}
      {reporteParaEditar && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto"
          onClick={() => setReporteParaEditar(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#fb8500]" />
                Edición de Metadatos — Reporte #{reporteParaEditar.id}
              </h2>
              <button
                onClick={() => setReporteParaEditar(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <FormularioReporteAdministrativo
              reporteParaEditar={reporteParaEditar}
              onExito={(res) => {
                const edicion = res as RespuestaEdicionReporte;
                setReporteParaEditar(null);
                setMensajeFeedback({
                  tipo: 'exito',
                  texto: edicion.actualizado
                    ? `Reporte #${edicion.id} actualizado exitosamente.`
                    : `Reporte #${edicion.id} sin modificaciones en metadatos.`,
                });
                void cargarReportes();
                if (reporteSeleccionado && reporteSeleccionado.id === edicion.id) {
                  void abrirDetalle(edicion.id);
                }
              }}
              onCancelar={() => setReporteParaEditar(null)}
            />
          </div>
        </div>
      )}

      {/* Modal de Devolución A10 */}
      {reporteParaDevolver && (
        <ModalDevolucion
          reporte={reporteParaDevolver}
          enviando={operandoId === reporteParaDevolver.id}
          onSubmit={handleConfirmarDevolucion}
          onCancelar={() => setReporteParaDevolver(null)}
        />
      )}

      {/* Modal de Confirmación de Recepción A14 */}
      {reporteParaRecepcionar && (
        <ModalConfirmacionRecepcion
          reporte={reporteParaRecepcionar}
          enviando={operandoId === reporteParaRecepcionar.id}
          onConfirmar={async () => {
            await handleRecepcionar(reporteParaRecepcionar.id);
          }}
          onCancelar={() => setReporteParaRecepcionar(null)}
        />
      )}

      {/* Modal Selector de Contraparte de Cierre A13 / A14 */}
      {reporteParaCerrar && (
        <ModalSelectorCierre
          reportePerdido={reporteParaCerrar}
          enviando={operandoId === reporteParaCerrar.id}
          onConfirmarCierre={async (reporteEncontradoId) => {
            await handleCerrarPerdido(reporteParaCerrar.id, reporteEncontradoId);
          }}
          onCancelar={() => setReporteParaCerrar(null)}
        />
      )}

      {/* Modal de Detalle con Traza y Acciones */}
      {(cargandoDetalle || errorDetalle || reporteSeleccionado) && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={cerrarDetalle}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <h3 className="text-xl font-bold text-gray-900">
                  {reporteSeleccionado
                    ? `Reporte #${reporteSeleccionado.id}: ${reporteSeleccionado.titulo}`
                    : 'Detalle de Reporte'}
                </h3>
                <button
                  onClick={cerrarDetalle}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {cargandoDetalle && (
                <div className="py-12 text-center text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
                  Cargando información completa...
                </div>
              )}

              {errorDetalle && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm mb-4">
                  {errorDetalle}
                </div>
              )}

              {reporteSeleccionado && (
                <div className="space-y-6">
                  {/* Imagen y badges de cabecera */}
                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    {resolverUrlImagen(reporteSeleccionado.imagen) ? (
                      <img
                        src={resolverUrlImagen(reporteSeleccionado.imagen)!}
                        alt={reporteSeleccionado.titulo}
                        className="w-full sm:w-48 h-48 object-cover rounded-lg border border-gray-200 bg-gray-50 shrink-0"
                      />
                    ) : (
                      <div className="w-full sm:w-48 h-48 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 text-gray-400">
                        <Package className="w-12 h-12" />
                      </div>
                    )}

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                            reporteSeleccionado.estado,
                          )}`}
                        >
                          {getStatusIcon(reporteSeleccionado.estado)}
                          {reporteSeleccionado.estado}
                        </span>

                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded border border-gray-200 font-medium capitalize">
                          Tipo: {reporteSeleccionado.tipo_reporte}
                        </span>

                        {!reporteSeleccionado.activo ? (
                          <span className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded font-bold">
                            Archivado
                          </span>
                        ) : (
                          <span className="text-xs bg-emerald-50 text-emerald-800 px-2 py-1 rounded border border-emerald-200 font-semibold">
                            Activo
                          </span>
                        )}
                      </div>

                      <h4 className="text-lg font-bold text-gray-900">
                        {reporteSeleccionado.titulo}
                      </h4>
                      <p className="text-xs text-gray-500 font-mono">
                        Identificador único: #{reporteSeleccionado.id}
                      </p>
                    </div>
                  </div>

                  {/* Metadatos descriptivos en cuadrícula */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <div className="sm:col-span-2">
                      <span className="block text-xs font-semibold text-gray-500 uppercase">
                        Descripción
                      </span>
                      <p className="text-gray-800 mt-1 whitespace-pre-wrap bg-white p-3 rounded border border-gray-200">
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
                        <div className="text-xs">
                          <p className="font-medium">
                            {reporteSeleccionado.tipo_autor === 'admin'
                              ? reporteSeleccionado.administrador_nombre || 'Administrador'
                              : reporteSeleccionado.usuario_nombre || 'Estudiante'}
                          </p>
                          {reporteSeleccionado.usuario_correo && (
                            <p className="text-gray-500">{reporteSeleccionado.usuario_correo}</p>
                          )}
                          <p className="text-[11px] text-gray-400 capitalize">
                            {reporteSeleccionado.tipo_autor === 'admin'
                              ? 'Personal administrativo'
                              : 'Usuario estudiante'}
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

                  {/* Acciones contextuales sobre el reporte */}
                  {puedeMutar && (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                      <p className="font-bold text-gray-900 text-sm">
                        Acciones Operativas Disponibles
                      </p>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Recepción: solo en Encontrado activo */}
                        {reporteSeleccionado.estado === 'Encontrado' &&
                          reporteSeleccionado.activo && (
                            <button
                              onClick={() => setReporteParaRecepcionar(reporteSeleccionado)}
                              disabled={operandoId === reporteSeleccionado.id}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              {operandoId === reporteSeleccionado.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Shield className="w-3.5 h-3.5" />
                              )}
                              Recepcionar en Servicios
                            </button>
                          )}

                        {/* Devolución: solo en En servicios activo */}
                        {reporteSeleccionado.estado === 'En servicios' &&
                          reporteSeleccionado.activo && (
                            <button
                              onClick={() => setReporteParaDevolver(reporteSeleccionado)}
                              disabled={operandoId === reporteSeleccionado.id}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Devolver a Propietario (A10)
                            </button>
                          )}

                        {/* Cierre: solo en Perdido activo */}
                        {reporteSeleccionado.estado === 'Perdido' &&
                          reporteSeleccionado.activo && (
                            <button
                              onClick={() => setReporteParaCerrar(reporteSeleccionado)}
                              disabled={operandoId === reporteSeleccionado.id}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              {operandoId === reporteSeleccionado.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <ArrowRightCircle className="w-3.5 h-3.5" />
                              )}
                              Cerrar por Enlace
                            </button>
                          )}

                        {/* Donación: solo en En servicios activo y rol admin */}
                        {reporteSeleccionado.estado === 'En servicios' &&
                          reporteSeleccionado.activo &&
                          esAdmin && (
                            <button
                              onClick={() => void handleDonar(reporteSeleccionado.id)}
                              disabled={operandoId === reporteSeleccionado.id}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              {operandoId === reporteSeleccionado.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Gift className="w-3.5 h-3.5" />
                              )}
                              Asignar a Donación
                            </button>
                          )}

                        {/* Edición de metadatos: activo y no terminal */}
                        {reporteSeleccionado.activo &&
                          reporteSeleccionado.estado !== 'Devuelto' &&
                          reporteSeleccionado.estado !== 'Donado' && (
                            <button
                              onClick={() => setReporteParaEditar(reporteSeleccionado)}
                              disabled={operandoId === reporteSeleccionado.id}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Editar Metadatos
                            </button>
                          )}

                        {/* Archivo: activo */}
                        {reporteSeleccionado.activo && (
                          <button
                            onClick={() => void handleArchivar(reporteSeleccionado.id)}
                            disabled={operandoId === reporteSeleccionado.id}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            {operandoId === reporteSeleccionado.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Archive className="w-3.5 h-3.5" />
                            )}
                            Archivar Expediente
                          </button>
                        )}

                        {/* Reactivación: archivado */}
                        {!reporteSeleccionado.activo && (
                          <button
                            onClick={() => void handleReactivar(reporteSeleccionado.id)}
                            disabled={operandoId === reporteSeleccionado.id}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            {operandoId === reporteSeleccionado.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5" />
                            )}
                            Reactivar Reporte
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sección de Traza e Historial Auditado */}
                  <div className="pt-4 border-t border-gray-200 space-y-3">
                    <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <History className="w-4 h-4 text-gray-600" />
                      Historial de Traza y Auditoría
                    </h4>

                    {cargandoTraza && (
                      <div className="py-4 text-center text-xs text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-gray-400" />
                        Cargando traza cronológica...
                      </div>
                    )}

                    {errorTraza && (
                      <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded text-xs">
                        {errorTraza}
                      </div>
                    )}

                    {traza?.verificacion_devolucion && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs space-y-1">
                        <p className="font-bold text-green-900 flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-green-700" />
                          Verificación de Devolución (A10)
                        </p>
                        <p className="text-green-800">
                          <strong>Receptor:</strong> {traza.verificacion_devolucion.nombre_receptor}
                        </p>
                        <p className="text-green-800">
                          <strong>Descripción del comprobante o verificación:</strong>{' '}
                          {traza.verificacion_devolucion.referencia_comprobante}
                        </p>
                        {traza.verificacion_devolucion.observacion && (
                          <p className="text-green-800">
                            <strong>Observación:</strong>{' '}
                            {traza.verificacion_devolucion.observacion}
                          </p>
                        )}
                        {traza.verificacion_devolucion.usuario_id && (
                          <p className="text-green-700">
                            <strong>ID Usuario Estudiante:</strong>{' '}
                            {traza.verificacion_devolucion.usuario_id}
                          </p>
                        )}
                      </div>
                    )}

                    {traza?.enlace_cierre && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-1">
                        <p className="font-bold text-blue-900 flex items-center gap-1.5">
                          <ArrowRightCircle className="w-4 h-4 text-blue-700" />
                          Cierre por Enlace (A13)
                        </p>
                        <p className="text-blue-800">
                          <strong>Hallazgo Vinculado:</strong> Reporte #{traza.enlace_cierre.reporte_encontrado_id}
                        </p>
                        {traza.enlace_cierre.entrega_original && (
                          <div className="mt-1.5 pt-1.5 border-t border-blue-200 space-y-0.5 text-blue-800">
                            <p className="font-semibold text-blue-900">Entrega Física Original A10:</p>
                            <p>
                              <strong>Receptor:</strong> {traza.enlace_cierre.entrega_original.nombre_receptor}
                            </p>
                            <p>
                              <strong>Comprobante:</strong> {traza.enlace_cierre.entrega_original.referencia_comprobante}
                            </p>
                            {traza.enlace_cierre.entrega_original.observacion && (
                              <p>
                                <strong>Observación:</strong> {traza.enlace_cierre.entrega_original.observacion}
                              </p>
                            )}
                            {traza.enlace_cierre.entrega_original.usuario_id && (
                              <p className="text-blue-700">
                                <strong>ID Usuario Estudiante:</strong> {traza.enlace_cierre.entrega_original.usuario_id}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {traza?.nota_cierre_historico && (
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700 space-y-0.5">
                        <p className="font-semibold text-gray-900">Nota de Cierre Histórico (A15):</p>
                        <p className="italic text-gray-600">{traza.nota_cierre_historico}</p>
                      </div>
                    )}

                    {traza?.historial && traza.historial.length > 0 ? (
                      <div className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50/50 max-h-56 overflow-y-auto">
                        {traza.historial.map((item) => (
                          <div
                            key={item.id}
                            className="bg-white p-2.5 rounded border border-gray-200 text-xs space-y-1 shadow-2xs"
                          >
                            <div className="flex items-center justify-between text-gray-600">
                              <span className="font-semibold text-gray-900">
                                {formatearAccionTraza(item.accion)}
                              </span>
                              <span className="text-[11px] text-gray-600 font-mono">
                                {item.fecha}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-500 flex items-center justify-between">
                              <span>
                                Realizado por: {item.tipo_realizado_por === 'admin' ? 'Administrador' : 'Usuario'} (#{item.realizado_por})
                              </span>
                              {item.valor_anterior || item.valor_nuevo ? (
                                <span className="font-mono text-gray-700">
                                  {item.valor_anterior || '(inicio)'} → {item.valor_nuevo || '(fin)'}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : !cargandoTraza && !errorTraza ? (
                      <p className="text-xs text-gray-600 italic">
                        No hay registros de historial adicionales para este reporte.
                      </p>
                    ) : null}
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex justify-end">
                    <button
                      onClick={cerrarDetalle}
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
