import type { DatosAltaReporte } from '../services/reportService';

const ID_MAXIMO = 2147483647;
const TAMANO_MAXIMO_IMAGEN = 5 * 1024 * 1024;
const TIPOS_IMAGEN = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const EXTENSIONES_IMAGEN = new Set(['jpg', 'jpeg', 'png']);

export interface ImagenFormulario {
  nombre: string;
  tipo: string;
  tamanoBytes: number | null;
}

export interface FormularioReporte {
  tipo_reporte: string;
  categoria_id: number | null;
  fecha_incidente: string;
  campus: string;
  ubicacion_id: number | null;
  ubicacion_otro: string;
  titulo: string;
  descripcion: string;
  contacto: string;
  imagen: ImagenFormulario | null;
}

export type ValidacionReporte =
  | { valido: true; datos: DatosAltaReporte }
  | { valido: false; mensaje: string };

export function fechaLocalHoy(ahora: Date = new Date()): string {
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(ahora.getDate()).padStart(2, '0')}`;
}

export function esFechaReal(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return false;
  }
  const [anio, mes, dia] = fecha.split('-').map(Number);
  if (
    anio === undefined ||
    mes === undefined ||
    dia === undefined ||
    anio === 0 ||
    mes < 1 ||
    mes > 12 ||
    dia < 1
  ) {
    return false;
  }
  const bisiesto = anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0);
  const diasPorMes = [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dia <= (diasPorMes[mes - 1] ?? 0);
}

function texto(valor: string): string {
  return valor.trim();
}

function idPositivo(valor: number | null): boolean {
  return (
    typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 1 && valor <= ID_MAXIMO
  );
}

function validarImagen(imagen: ImagenFormulario): string | null {
  const tipo = imagen.tipo.trim().toLowerCase();
  const extension = imagen.nombre.split('.').pop()?.toLowerCase() ?? '';
  const tipoValido = tipo.length > 0 ? TIPOS_IMAGEN.has(tipo) : EXTENSIONES_IMAGEN.has(extension);

  if (!tipoValido) {
    return 'La foto debe ser JPG, JPEG o PNG.';
  }
  if (
    imagen.tamanoBytes === null ||
    !Number.isFinite(imagen.tamanoBytes) ||
    imagen.tamanoBytes <= 0
  ) {
    return 'No se pudo verificar el tamaño de la foto.';
  }
  if (imagen.tamanoBytes > TAMANO_MAXIMO_IMAGEN) {
    return 'La foto no puede superar los 5 MB.';
  }
  return null;
}

export function validarFormularioReporte(
  formulario: FormularioReporte,
  opciones: { hoy?: string } = {}
): ValidacionReporte {
  const hoy = opciones.hoy ?? fechaLocalHoy();
  const tipo = formulario.tipo_reporte.trim().toLowerCase();
  if (tipo !== 'perdido' && tipo !== 'encontrado') {
    return { valido: false, mensaje: 'Selecciona si el objeto se perdió o se encontró.' };
  }

  const categoriaId = formulario.categoria_id;
  if (categoriaId === null || !idPositivo(categoriaId)) {
    return { valido: false, mensaje: 'Selecciona una categoría válida.' };
  }

  const fecha = formulario.fecha_incidente.trim();
  if (!esFechaReal(hoy)) {
    return { valido: false, mensaje: 'La fecha de hoy no es válida.' };
  }
  if (!esFechaReal(fecha) || fecha > hoy) {
    return {
      valido: false,
      mensaje: 'La fecha del incidente debe ser real y no futura (AAAA-MM-DD).',
    };
  }

  const campus = texto(formulario.campus);
  if (!campus || campus.length > 50) {
    return {
      valido: false,
      mensaje: 'El campus es obligatorio y admite hasta 50 caracteres.',
    };
  }

  const ubicacionId = formulario.ubicacion_id;
  const ubicacionOtro = texto(formulario.ubicacion_otro);
  const tieneId = ubicacionId !== null;
  const tieneOtro = ubicacionOtro.length > 0;
  if (tieneId && tieneOtro) {
    return {
      valido: false,
      mensaje: 'Indica solo una ubicación: catálogo u «Otro».',
    };
  }
  if (!tieneId && !tieneOtro) {
    return { valido: false, mensaje: 'Selecciona una ubicación o escribe «Otro».' };
  }
  if (tieneId && !idPositivo(ubicacionId)) {
    return { valido: false, mensaje: 'La ubicación seleccionada no es válida.' };
  }
  if (tieneOtro && ubicacionOtro.length > 255) {
    return {
      valido: false,
      mensaje: 'La ubicación «Otro» admite hasta 255 caracteres.',
    };
  }

  const titulo = texto(formulario.titulo);
  if (!titulo || titulo.length > 255) {
    return {
      valido: false,
      mensaje: 'El título es obligatorio y admite hasta 255 caracteres.',
    };
  }

  const descripcion = texto(formulario.descripcion);
  if (!descripcion) {
    return { valido: false, mensaje: 'La descripción es obligatoria.' };
  }

  const contacto = texto(formulario.contacto);
  if (!contacto || contacto.length > 255) {
    return {
      valido: false,
      mensaje: 'El contacto es obligatorio y admite hasta 255 caracteres.',
    };
  }

  if (!formulario.imagen) {
    return { valido: false, mensaje: 'La foto es obligatoria.' };
  }
  const errorImagen = validarImagen(formulario.imagen);
  if (errorImagen) {
    return { valido: false, mensaje: errorImagen };
  }

  const datos: DatosAltaReporte = {
    tipo_reporte: tipo,
    categoria_id: categoriaId,
    fecha_incidente: fecha,
    campus,
    titulo,
    descripcion,
    contacto,
  };

  if (tieneId && ubicacionId !== null) {
    datos.ubicacion_id = ubicacionId;
  } else {
    datos.ubicacion_otro = ubicacionOtro;
  }

  return { valido: true, datos };
}
