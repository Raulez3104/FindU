import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Image as ImageIcon, Loader2 } from 'lucide-react';
import type {
  CategoriaCatalogo,
  UbicacionCatalogo,
  RespuestaCrearReporte,
  RespuestaEdicionReporte,
  Reporte,
} from '../types/api';
import { servicioCatalogos } from '../services/servicioCatalogos';
import { crearReporteAdministrativo, editarReporte } from '../services/reportService';
import { ErrorApi } from '../services/api';

interface FormularioReporteAdministrativoProps {
  readonly reporteParaEditar?: Reporte | null;
  readonly onExito: (respuesta: RespuestaCrearReporte | RespuestaEdicionReporte) => void;
  readonly onCancelar: () => void;
}

function obtenerFechaHoy(): string {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

const CAMPUS_OPCIONES = [
  { valor: 'principal', etiqueta: 'Campus Principal' },
];

const FormularioReporteAdministrativo: React.FC<FormularioReporteAdministrativoProps> = ({
  reporteParaEditar,
  onExito,
  onCancelar,
}) => {
  const esModoEdicion = Boolean(reporteParaEditar);

  const [titulo, setTitulo] = useState(() => reporteParaEditar?.titulo || '');
  const [descripcion, setDescripcion] = useState(
    () => reporteParaEditar?.descripcion || '',
  );
  const [contacto, setContacto] = useState(() => reporteParaEditar?.contacto || '');
  const [categoriaId, setCategoriaId] = useState<number | ''>(
    () => reporteParaEditar?.categoria_id ?? '',
  );
  const [fechaIncidente, setFechaIncidente] = useState(() => {
    if (reporteParaEditar?.fecha_incidente) {
      const corte = reporteParaEditar.fecha_incidente.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(corte)) return corte;
    }
    return obtenerFechaHoy();
  });
  const [campus, setCampus] = useState(
    () => reporteParaEditar?.campus || 'principal',
  );
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState<string>(() => {
    if (reporteParaEditar?.ubicacion_id) {
      return String(reporteParaEditar.ubicacion_id);
    }
    if (reporteParaEditar?.ubicacion_otro) {
      return 'otro';
    }
    return '';
  });
  const [ubicacionOtro, setUbicacionOtro] = useState(
    () => reporteParaEditar?.ubicacion_otro || '',
  );
  const [archivoImagen, setArchivoImagen] = useState<File | null>(null);
  const [previewImagen, setPreviewImagen] = useState<string | null>(null);

  const [categorias, setCategorias] = useState<CategoriaCatalogo[]>([]);
  const [ubicaciones, setUbicaciones] = useState<UbicacionCatalogo[]>([]);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);

  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  useEffect(() => {
    let montado = true;
    async function cargarCategoriasIniciales() {
      try {
        const cats = await servicioCatalogos.obtenerCategorias();
        if (montado) {
          setCategorias(cats);
          if (!esModoEdicion && cats.length > 0) {
            setCategoriaId(cats[0].id);
          }
        }
      } catch (err) {
        if (montado) {
          setErrorGeneral(
            err instanceof Error ? err.message : 'No fue posible cargar las categorías',
          );
        }
      } finally {
        if (montado) {
          setCargandoCatalogos(false);
        }
      }
    }
    void cargarCategoriasIniciales();
    return () => {
      montado = false;
    };
  }, [esModoEdicion]);

  useEffect(() => {
    let montado = true;
    async function cargarUbicacionesPorCampus() {
      try {
        const ubis = await servicioCatalogos.obtenerUbicaciones(campus);
        if (montado) {
          setUbicaciones(ubis);
        }
      } catch {
        // Conservar las existentes si hay fallo transitorio
      }
    }
    void cargarUbicacionesPorCampus();
    return () => {
      montado = false;
    };
  }, [campus]);

  const handleCambioCampus = (nuevoCampus: string) => {
    setCampus(nuevoCampus);
    setUbicacionSeleccionada('');
    setUbicacionOtro('');
  };

  const handleSeleccionarArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setArchivoImagen(null);
      setPreviewImagen(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorGeneral('La imagen no puede exceder 5 MB.');
      e.target.value = '';
      return;
    }

    const tiposPermitidos = ['image/jpeg', 'image/png'];
    if (!tiposPermitidos.includes(file.type)) {
      setErrorGeneral('Solo se admiten imágenes JPG o PNG.');
      e.target.value = '';
      return;
    }

    setErrorGeneral(null);
    setArchivoImagen(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewImagen(objectUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando) return;

    setErrorGeneral(null);
    setMensajeExito(null);

    const tit = titulo.trim();
    const desc = descripcion.trim();
    const cont = contacto.trim();

    if (!tit) {
      setErrorGeneral('El título es requerido.');
      return;
    }
    if (!desc) {
      setErrorGeneral('La descripción es requerida.');
      return;
    }
    if (!cont) {
      setErrorGeneral('El contacto es requerido.');
      return;
    }
    if (!categoriaId) {
      setErrorGeneral('Debes seleccionar una categoría.');
      return;
    }
    if (!fechaIncidente) {
      setErrorGeneral('La fecha del hallazgo es requerida.');
      return;
    }
    const hoyStr = obtenerFechaHoy();
    if (fechaIncidente > hoyStr) {
      setErrorGeneral('La fecha del incidente no puede ser futura.');
      return;
    }

    if (!ubicacionSeleccionada) {
      setErrorGeneral('Debes seleccionar una ubicación en el campus o elegir "Otra ubicación no listada".');
      return;
    }

    if (ubicacionSeleccionada === 'otro' && !ubicacionOtro.trim()) {
      setErrorGeneral('Debes especificar el detalle de la otra ubicación.');
      return;
    }

    const ubicacionIdNum =
      ubicacionSeleccionada !== 'otro'
        ? Number(ubicacionSeleccionada)
        : undefined;
    const ubicacionOtroStr =
      ubicacionSeleccionada === 'otro'
        ? ubicacionOtro.trim()
        : undefined;

    if (esModoEdicion && reporteParaEditar) {
      setEnviando(true);
      try {
        const res = await editarReporte(reporteParaEditar.id, {
          titulo: tit,
          descripcion: desc,
          contacto: cont,
          categoria_id: Number(categoriaId),
          fecha_incidente: fechaIncidente,
          campus,
          ubicacion_id: ubicacionIdNum,
          ubicacion_otro: ubicacionOtroStr,
        });

        const texto = res.actualizado
          ? `Reporte #${res.id} actualizado exitosamente.`
          : `Reporte #${res.id} sin cambios detectados en los metadatos.`;

        setMensajeExito(texto);
        onExito(res);
      } catch (err) {
        if (err instanceof ErrorApi) {
          if (err.esConflicto) {
            setErrorGeneral(
              'No es posible editar: el reporte está archivado o en un estado terminal (Devuelto/Donado).',
            );
          } else if (err.status === 404) {
            setErrorGeneral('El reporte solicitado no existe o fue retirado del sistema (404).');
          } else if (err.esNoAutorizado) {
            setErrorGeneral('No tienes autorización para editar reportes.');
          } else if (err.esNoAutenticado) {
            setErrorGeneral('Tu sesión ha expirado.');
          } else {
            setErrorGeneral(err.message || 'Error al editar el reporte.');
          }
        } else if (err instanceof Error) {
          setErrorGeneral(err.message);
        } else {
          setErrorGeneral('Ocurrió un error inesperado al editar el reporte.');
        }
      } finally {
        setEnviando(false);
      }
      return;
    }

    if (!archivoImagen) {
      setErrorGeneral('La fotografía del objeto encontrado es requerida.');
      return;
    }

    setEnviando(true);
    try {
      const res = await crearReporteAdministrativo({
        titulo: tit,
        descripcion: desc,
        contacto: cont,
        categoria_id: Number(categoriaId),
        fecha_incidente: fechaIncidente,
        campus,
        ubicacion_id: ubicacionIdNum,
        ubicacion_otro: ubicacionOtroStr,
        image: archivoImagen,
      });

      setMensajeExito(
        `Reporte #${res.id} registrado exitosamente en estado "En servicios".`,
      );
      onExito(res);
    } catch (err) {
      if (err instanceof ErrorApi) {
        if (err.esNoAutorizado) {
          setErrorGeneral(
            'No tienes autorización para registrar reportes administrativos.',
          );
        } else if (err.esNoAutenticado) {
          setErrorGeneral('Tu sesión ha expirado.');
        } else {
          setErrorGeneral(err.message || 'Error al registrar el reporte.');
        }
      } else if (err instanceof Error) {
        setErrorGeneral(err.message);
      } else {
        setErrorGeneral('Ocurrió un error inesperado al enviar el reporte.');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorGeneral && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{errorGeneral}</span>
        </div>
      )}

      {mensajeExito && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-start gap-2">
          <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{mensajeExito}</span>
        </div>
      )}

      {esModoEdicion ? (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
          <p className="font-semibold">Edición Auditada de Metadatos (A2)</p>
          <p className="mt-0.5 text-blue-700">
            Modificación de campos descriptivos institucionales. La fotografía, el estado y el tipo de reporte no se modifican desde este formulario.
          </p>
        </div>
      ) : (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
          <p className="font-semibold">Reporte Administrativo de Objeto Encontrado</p>
          <p className="mt-0.5 text-blue-700">
            Todo reporte administrativo se registra como hallazgo y nace en custodia institucional con estado «En servicios».
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
            Título del Objeto <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            maxLength={100}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej. Mochila negra con útiles"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 bg-white focus:ring-2 focus:ring-[#fb8500] focus:border-transparent outline-none"
            disabled={enviando}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
            Descripción Detallada <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={3}
            maxLength={1000}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Detalles sobre características, marcas, color, contenido..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 bg-white focus:ring-2 focus:ring-[#fb8500] focus:border-transparent outline-none"
            disabled={enviando}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
            Contacto del Informante / Custodio <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            maxLength={100}
            value={contacto}
            onChange={(e) => setContacto(e.target.value)}
            placeholder="Ej. Oficina de Servicios Estudiantiles / Int. 1234"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 bg-white focus:ring-2 focus:ring-[#fb8500] focus:border-transparent outline-none"
            disabled={enviando}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
            Categoría Institucional <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={categoriaId}
            onChange={(e) =>
              setCategoriaId(e.target.value ? Number(e.target.value) : '')
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-[#fb8500] focus:border-transparent outline-none"
            disabled={enviando || cargandoCatalogos}
          >
            {cargandoCatalogos ? (
              <option value="">Cargando categorías...</option>
            ) : (
              categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
            Fecha del Hallazgo / Incidente <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            required
            max={obtenerFechaHoy()}
            value={fechaIncidente}
            onChange={(e) => setFechaIncidente(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-[#fb8500] focus:border-transparent outline-none"
            disabled={enviando}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
            Campus <span className="text-red-500">*</span>
          </label>
          <select
            value={campus}
            onChange={(e) => handleCambioCampus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-[#fb8500] focus:border-transparent outline-none"
            disabled={enviando}
          >
            {CAMPUS_OPCIONES.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
            Ubicación en Campus <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={ubicacionSeleccionada}
            onChange={(e) => {
              setUbicacionSeleccionada(e.target.value);
              if (e.target.value !== 'otro') {
                setUbicacionOtro('');
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:ring-2 focus:ring-[#fb8500] focus:border-transparent outline-none"
            disabled={enviando}
          >
            <option value="">-- Seleccionar ubicación del campus --</option>
            {ubicaciones.map((ubi) => (
              <option key={ubi.id} value={ubi.id}>
                {ubi.nombre}
              </option>
            ))}
            <option value="otro">Otra ubicación no listada</option>
          </select>
        </div>

        {ubicacionSeleccionada === 'otro' && (
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Detalle de Otra Ubicación <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={200}
              value={ubicacionOtro}
              onChange={(e) => setUbicacionOtro(e.target.value)}
              placeholder="Ej. Jardín central, cerca de cafetería"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 bg-white focus:ring-2 focus:ring-[#fb8500] focus:border-transparent outline-none"
              disabled={enviando}
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Especifique el lugar donde se halló el objeto cuando no esté en el catálogo.
            </p>
          </div>
        )}

        {!esModoEdicion && (
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Fotografía del Objeto <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
              {previewImagen ? (
                <img
                  src={previewImagen}
                  alt="Vista previa"
                  className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                />
              ) : (
                <div className="w-24 h-24 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400">
                  <ImageIcon className="w-8 h-8" />
                </div>
              )}
              <div className="flex-1 text-center sm:text-left">
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleSeleccionarArchivo}
                  className="text-xs text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#fb8500] file:text-white hover:file:bg-[#e07500] cursor-pointer"
                  disabled={enviando}
                />
                <p className="text-xs text-gray-600 mt-1">
                  Formatos permitidos: JPG, PNG (máx. 5 MB).
                </p>
              </div>
            </div>
          </div>
        )}
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
          className="inline-flex items-center gap-2 px-5 py-2 bg-[#fb8500] hover:bg-[#e07500] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          disabled={enviando}
        >
          {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
          {enviando
            ? esModoEdicion
              ? 'Guardando cambios...'
              : 'Registrando hallazgo...'
            : esModoEdicion
              ? 'Guardar Cambios'
              : 'Registrar Reporte'}
        </button>
      </div>
    </form>
  );
};

export default FormularioReporteAdministrativo;