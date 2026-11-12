import type {
  AutorReporte,
  ConteoPg,
  ContraparteCierreValida,
  DatosAltaReporte,
  DatosEdicionReporte,
  DecisionOperacion,
  DiferenciaEdicion,
  EnlaceCierreExistente,
  EstadoPresentado,
  EstadoReporte,
  EstadisticasReportes,
  FilaReporte,
  FormaUbicacion,
  OperacionAdministrativa,
  PerfilAdministrador,
  SolicitudCierreReporte,
  TipoAutor,
  TipoReporte,
  VerificacionDevolucionA10,
} from '../types/modelos';
import { esRolAutorizadoParaOperacion } from '../middleware/roleMiddleware';

type DatosObjeto = Record<string, unknown>;

interface OpcionesFecha {
  readonly hoy?: string;
}

interface CoincidenciaUbicacion {
  readonly id: number;
  readonly activo: boolean | null;
}

interface EntradaEstadisticas {
  readonly totales?: {
    readonly total?: ConteoPg;
    readonly activos?: ConteoPg;
    readonly inactivos?: ConteoPg;
  } | null;
  readonly porEstado?: readonly ({
    readonly estado?: unknown;
    readonly count?: ConteoPg;
  } | null)[] | null;
  readonly seriesFechas?: readonly ({
    readonly fecha?: string | null;
    readonly count?: ConteoPg;
  } | null)[] | null;
  readonly seriesUbicaciones?: readonly ({
    readonly campus?: string | null;
    readonly ubicacion?: string | null;
    readonly count?: ConteoPg;
  } | null)[] | null;
}

// Contrato puro: sin Express, consultas ni mutaciones de la entrada.
const CLAVES_ALTA = new Set([
  'tipo_reporte', 'titulo', 'descripcion', 'contacto',
  'categoria_id', 'fecha_incidente', 'campus', 'ubicacion_id', 'ubicacion_otro',
  'estado',
]);
const CLAVES_RETIRADAS = new Set([
  'usuario_id', 'user_id', 'administrador_id', 'ubicacion',
]);

const ESTADOS_PRESENTADOS = new Map<string, EstadoPresentado>([
  ['perdido', 'Perdido'],
  ['encontrado', 'Encontrado'],
  ['en_servicios', 'En servicios'],
  ['devuelto', 'Devuelto'],
  ['donado', 'Donado'],
]);

const tiene = (datos: object, clave: string) =>
  Object.prototype.hasOwnProperty.call(datos, clave);
const textoCanonico = (valor: unknown) =>
  typeof valor === 'string' ? valor.trim().toLowerCase() : '';

function rechazar(message: string): never {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

function validarObjeto(datos: unknown): asserts datos is DatosObjeto {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    rechazar('Los datos del reporte deben ser un objeto');
  }
}

function validarIdAlta(valor: unknown, campo: string) {
  if ((typeof valor !== 'number' && typeof valor !== 'string') ||
      !/^\d+$/.test(String(valor)) || !Number.isInteger(Number(valor)) || Number(valor) <= 0) {
    rechazar(`${campo} debe ser un entero positivo`);
  }
  if (Number(valor) > 2147483647) rechazar(`${campo} debe ser un entero positivo de hasta 2147483647`);
  return Number(valor);
}

// La ausencia de autor se valida en la resolución completa del alta (T3).
function normalizarEntrada(datos: unknown): DatosAltaReporte {
  validarObjeto(datos);
  for (const clave of Object.keys(datos)) {
    if (CLAVES_RETIRADAS.has(clave)) {
      rechazar(`Campo retirado del alta: ${clave}`);
    }
    if (!CLAVES_ALTA.has(clave)) {
      rechazar(`Campo no admitido: ${clave}`);
    }
  }
  return { ...datos };
}

// Solo resuelve altas. La inmutabilidad persistente de tipo_reporte corresponde
// a trg_tipo_reporte_inmutable; aquí no existe ninguna operación de edición.
// autor procede del servicio (usuario o admin interno), no acredita identidad.
function resolverTipoEstado(
  datos: unknown,
  autor: Pick<AutorReporte, 'tipo'> | null | undefined,
): { tipo_reporte: TipoReporte; estado: EstadoReporte } {
  validarObjeto(datos);
  if (!autor || !['usuario', 'admin'].includes(autor.tipo)) {
    rechazar('Se requiere un tipo de autor válido');
  }
  const tipoAutor: TipoAutor = autor.tipo;
  const tieneTipo = tiene(datos, 'tipo_reporte');
  const tipo = textoCanonico(tieneTipo ? datos.tipo_reporte : datos.estado);
  if (!['perdido', 'encontrado'].includes(tipo)) {
    rechazar('tipo_reporte debe ser perdido o encontrado');
  }
  const tipoReporte: TipoReporte = tipo === 'perdido' ? 'perdido' : 'encontrado';
  if (tipoAutor === 'admin' && tipoReporte !== 'encontrado') {
    rechazar('Un administrador solo puede originar reportes encontrados');
  }
  const estado: EstadoReporte = tipoAutor === 'admin' ? 'en_servicios' : tipoReporte;
  // Sin tipo explícito, estado perdido/encontrado actúa únicamente como tipo
  // legado. Con tipo explícito, solo se tolera el estado inicial derivado.
  if (tieneTipo && tiene(datos, 'estado') && textoCanonico(datos.estado) !== estado) {
    rechazar('estado no coincide con el estado inicial derivado');
  }
  return { tipo_reporte: tipoReporte, estado };
}

function esFechaReal(fecha: unknown): fecha is string {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [anio, mes, dia] = fecha.split('-').map(Number);
  if (anio === 0 || mes < 1 || mes > 12 || dia < 1) return false;
  const bisiesto = anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0);
  const diasPorMes = [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dia <= diasPorMes[mes - 1];
}

function fechaActual() {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
}

// DATE se compara como fecha civil, sin convertirla en un instante UTC.
function validarFechaIncidente(fecha: unknown, { hoy = fechaActual() }: OpcionesFecha = {}) {
  if (!esFechaReal(hoy)) throw new Error('hoy debe ser una fecha válida YYYY-MM-DD');
  if (!esFechaReal(fecha) || fecha > hoy) {
    rechazar('fecha_incidente debe ser una fecha válida YYYY-MM-DD no futura');
  }
  return fecha;
}

function presentarEstado(estado: unknown) {
  return typeof estado === 'string' ? ESTADOS_PRESENTADOS.get(estado) : undefined;
}

function textoObligatorio(valor: unknown, campo: string, maximo?: number) {
  if (typeof valor !== 'string' || !valor.trim()) {
    rechazar(`${campo} debe ser un texto no vacío`);
  }
  const texto = valor.trim();
  // PostgreSQL char_length cuenta puntos de código, no bytes ni unidades UTF-16.
  if (maximo !== undefined && [...texto].length > maximo) {
    rechazar(`${campo} admite como máximo ${maximo} caracteres`);
  }
  return texto;
}

// Valida la forma; existencia, activo y pertenencia al campus se consultan en T3.
function resolverFormaUbicacion(datos: unknown): FormaUbicacion {
  validarObjeto(datos);
  if (tiene(datos, 'ubicacion')) rechazar('Campo retirado del alta: ubicacion');
  const campus = textoObligatorio(datos.campus, 'campus', 50);
  const formas = ['ubicacion_id', 'ubicacion_otro'].filter((clave) => tiene(datos, clave));
  if (formas.length !== 1) rechazar('Debe indicar exactamente una forma de ubicación');
  const campo = formas[0];
  if (campo === 'ubicacion_id') {
    return { campus, forma: 'id', ubicacion_id: validarIdAlta(datos[campo], campo) };
  }
  return { campus, forma: 'otro', ubicacion_otro: textoObligatorio(datos[campo], campo, 255) };
}

// Recibe las filas YA consultadas por LOWER(nombre) y campus, sin filtrar activo.
// El índice único del catálogo garantiza como máximo una coincidencia.
function resolverUbicacionPorNombre(
  nombre: unknown,
  coincidencias: readonly CoincidenciaUbicacion[],
) {
  const texto = textoObligatorio(nombre, 'ubicacion');
  if (coincidencias.length === 0) return { ubicacion_id: null, ubicacion_otro: textoObligatorio(texto, 'ubicacion', 255) };
  const ubicacion = coincidencias[0];
  if (ubicacion.activo !== true) rechazar('La ubicación está inactiva');
  return { ubicacion_id: ubicacion.id, ubicacion_otro: null };
}

// Solo autoriza cambios reales. El servicio tratará la igualdad antes de llamar
// a esta regla: devuelve cambiado:false sin UPDATE ni historial (T7).
function esTransicionValida(tipo: unknown, actual: unknown, nuevo: unknown) {
  if (tipo === 'perdido') return actual === 'perdido' && nuevo === 'devuelto';
  if (tipo !== 'encontrado') return false;
  return (actual === 'encontrado' && nuevo === 'en_servicios') ||
    (actual === 'en_servicios' && (nuevo === 'devuelto' || nuevo === 'donado'));
}

const conteo = (valor: ConteoPg | undefined) => Number(valor ?? 0);

// Recibe agregados del servicio, no reportes: no consulta, agrupa ni filtra
// activos. T8 agrupará fechas YYYY-MM-DD y catálogo por campus, sin texto libre.
function formatearEstadisticas({
  totales,
  porEstado,
  seriesFechas,
  seriesUbicaciones,
}: EntradaEstadisticas = {}): EstadisticasReportes {
  const estados = Object.fromEntries(
    [...ESTADOS_PRESENTADOS.values()].map((etiqueta) => [etiqueta, 0]),
  ) as Record<EstadoPresentado, number>;
  for (const fila of porEstado ?? []) {
    const etiqueta = presentarEstado(fila?.estado);
    if (etiqueta) estados[etiqueta] = conteo(fila?.count);
  }
  return {
    total: conteo(totales?.total),
    activos: conteo(totales?.activos),
    inactivos: conteo(totales?.inactivos),
    porEstado: estados,
    seriesFechas: (seriesFechas ?? []).filter((fila) => fila?.fecha != null)
      .map((fila) => ({ fecha: fila?.fecha ?? '', count: conteo(fila?.count) })),
    seriesUbicaciones: (seriesUbicaciones ?? [])
      .filter((fila) => fila?.campus != null && fila.ubicacion != null)
      .map((fila) => ({
        campus: fila?.campus ?? '',
        ubicacion: fila?.ubicacion ?? '',
        count: conteo(fila?.count),
      })),
  };
}

const CLAVES_A10 = new Set([
  'nombre_receptor',
  'referencia_comprobante',
  'observacion',
  'usuario_id',
]);

function validarVerificacionDevolucion(datos: unknown): VerificacionDevolucionA10 {
  validarObjeto(datos);
  for (const clave of Object.keys(datos)) {
    if (!CLAVES_A10.has(clave)) {
      rechazar(`Campo no admitido en verificación de devolución: ${clave}`);
    }
  }

  const nombre_receptor = textoObligatorio(
    datos.nombre_receptor,
    'nombre_receptor',
    255,
  );
  const referencia_comprobante = textoObligatorio(
    datos.referencia_comprobante,
    'referencia_comprobante',
    255,
  );

  const resultado: {
    nombre_receptor: string;
    referencia_comprobante: string;
    observacion?: string;
    usuario_id?: number;
  } = {
    nombre_receptor,
    referencia_comprobante,
  };

  if (tiene(datos, 'observacion')) {
    const obs = datos.observacion;
    if (obs !== null && obs !== undefined) {
      if (typeof obs !== 'string') {
        rechazar('observacion debe ser un texto');
      }
      const obsRecortada = obs.trim();
      if ([...obsRecortada].length > 1000) {
        rechazar('observacion admite como máximo 1000 caracteres');
      }
      if (obsRecortada.length > 0) {
        resultado.observacion = obsRecortada;
      }
    }
  }

  if (tiene(datos, 'usuario_id')) {
    const uid = datos.usuario_id;
    if (
      typeof uid !== 'number' ||
      !Number.isInteger(uid) ||
      uid < 1 ||
      uid > 2147483647
    ) {
      rechazar('usuario_id debe ser un entero positivo de hasta 2147483647');
    }
    resultado.usuario_id = uid;
  }

  return resultado;
}

const CLAVES_EDICION = new Set([
  'titulo',
  'descripcion',
  'contacto',
  'categoria_id',
  'fecha_incidente',
  'campus',
  'ubicacion_id',
  'ubicacion_otro',
]);

function validarFormaEdicion(
  datos: unknown,
  opciones: OpcionesFecha = {},
): DatosEdicionReporte {
  validarObjeto(datos);
  const clavesEnviadas = Object.keys(datos);
  if (clavesEnviadas.length === 0) {
    rechazar('Se requiere al menos un campo para la edición');
  }

  for (const clave of clavesEnviadas) {
    if (!CLAVES_EDICION.has(clave)) {
      rechazar(`Campo no admitido en edición: ${clave}`);
    }
  }

  if (tiene(datos, 'ubicacion_id') && tiene(datos, 'ubicacion_otro')) {
    rechazar('Debe indicar exactamente una forma de ubicación');
  }

  const resultado: {
    titulo?: string;
    descripcion?: string;
    contacto?: string;
    categoria_id?: number;
    fecha_incidente?: string;
    campus?: string;
    ubicacion_id?: number;
    ubicacion_otro?: string;
  } = {};

  if (tiene(datos, 'titulo')) {
    resultado.titulo = textoObligatorio(datos.titulo, 'titulo', 255);
  }
  if (tiene(datos, 'descripcion')) {
    resultado.descripcion = textoObligatorio(datos.descripcion, 'descripcion');
  }
  if (tiene(datos, 'contacto')) {
    resultado.contacto = textoObligatorio(datos.contacto, 'contacto', 255);
  }
  if (tiene(datos, 'categoria_id')) {
    resultado.categoria_id = validarIdAlta(datos.categoria_id, 'categoria_id');
  }
  if (tiene(datos, 'fecha_incidente')) {
    resultado.fecha_incidente = validarFechaIncidente(
      datos.fecha_incidente,
      opciones,
    );
  }
  if (tiene(datos, 'campus')) {
    resultado.campus = textoObligatorio(datos.campus, 'campus', 50);
  }
  if (tiene(datos, 'ubicacion_id')) {
    resultado.ubicacion_id = validarIdAlta(
      datos.ubicacion_id,
      'ubicacion_id',
    );
  }
  if (tiene(datos, 'ubicacion_otro')) {
    resultado.ubicacion_otro = textoObligatorio(
      datos.ubicacion_otro,
      'ubicacion_otro',
      255,
    );
  }

  return resultado;
}

function obtenerDiferenciasEdicion(
  reporteActual: FilaReporte,
  cambiosNormalizados: Partial<DatosEdicionReporte>,
): readonly DiferenciaEdicion[] {
  const diferencias: DiferenciaEdicion[] = [];

  const claves = Object.keys(cambiosNormalizados) as (keyof DatosEdicionReporte)[];

  for (const clave of claves) {
    if (clave === 'ubicacion_id') {
      const nuevoId = cambiosNormalizados.ubicacion_id;
      const anteriorId = reporteActual.ubicacion_id;
      if (nuevoId !== anteriorId) {
        diferencias.push({
          campo: 'ubicacion_id',
          valor_anterior: anteriorId != null ? String(anteriorId) : null,
          valor_nuevo: nuevoId != null ? String(nuevoId) : null,
        });
      }
      if (reporteActual.ubicacion_otro !== null) {
        diferencias.push({
          campo: 'ubicacion_otro',
          valor_anterior: reporteActual.ubicacion_otro,
          valor_nuevo: null,
        });
      }
    } else if (clave === 'ubicacion_otro') {
      const nuevoOtro = cambiosNormalizados.ubicacion_otro;
      const anteriorOtro = reporteActual.ubicacion_otro;
      if (nuevoOtro !== anteriorOtro) {
        diferencias.push({
          campo: 'ubicacion_otro',
          valor_anterior: anteriorOtro,
          valor_nuevo: nuevoOtro ?? null,
        });
      }
      if (reporteActual.ubicacion_id !== null) {
        diferencias.push({
          campo: 'ubicacion_id',
          valor_anterior: String(reporteActual.ubicacion_id),
          valor_nuevo: null,
        });
      }
    } else {
      const valorNuevo = cambiosNormalizados[clave];
      const valorAnterior = reporteActual[clave as keyof FilaReporte];
      const strNuevo = valorNuevo != null ? String(valorNuevo) : null;
      const strAnterior = valorAnterior != null ? String(valorAnterior) : null;

      if (strNuevo !== strAnterior) {
        diferencias.push({
          campo: clave,
          valor_anterior: strAnterior,
          valor_nuevo: strNuevo,
        });
      }
    }
  }

  return diferencias;
}

const CLAVES_CIERRE = new Set(['reporte_encontrado_id']);

function validarFormaCierre(cuerpo: unknown): SolicitudCierreReporte {
  validarObjeto(cuerpo);
  const claves = Object.keys(cuerpo);
  if (claves.length === 0) {
    rechazar('Se requiere el identificador de la contraparte');
  }
  for (const clave of claves) {
    if (!CLAVES_CIERRE.has(clave)) {
      rechazar(`Campo no admitido en cierre: ${clave}`);
    }
  }
  const id = (cuerpo as Record<string, unknown>).reporte_encontrado_id;
  if (
    typeof id !== 'number' ||
    !Number.isInteger(id) ||
    id < 1 ||
    id > 2147483647
  ) {
    rechazar('reporte_encontrado_id debe ser un entero positivo de hasta 2147483647');
  }
  return { reporte_encontrado_id: id };
}

function validarFormaBasicaSolicitud(
  operacion: OperacionAdministrativa,
  cuerpo: unknown,
  opciones: OpcionesFecha = {},
) {
  switch (operacion) {
    case 'recepcion':
    case 'donacion':
    case 'archivo':
    case 'reactivacion': {
      if (cuerpo === undefined || cuerpo === null) return {};
      if (typeof cuerpo === 'object' && !Array.isArray(cuerpo)) {
        if (Object.keys(cuerpo as object).length > 0) {
          rechazar('Esta operación no admite cuerpo de solicitud');
        }
        return {};
      }
      rechazar('Cuerpo de solicitud inválido');
      break;
    }
    case 'cierre':
      return validarFormaCierre(cuerpo);
    case 'devolucion':
      return validarVerificacionDevolucion(cuerpo);
    case 'edicion':
      return validarFormaEdicion(cuerpo, opciones);
    case 'alta':
      return normalizarEntrada(cuerpo);
    default:
      rechazar('Operación no reconocida');
  }
}

interface ParametrosDecisionOperacion {
  readonly operacion: OperacionAdministrativa;
  readonly reporte: FilaReporte;
  readonly actor: PerfilAdministrador;
  readonly payload: unknown;
  readonly hoy?: string;
  readonly enlaceExistente?: EnlaceCierreExistente | null;
  readonly esCierreHistoricoSinEnlace?: boolean;
  readonly contraparteValida?: ContraparteCierreValida | null;
}

function decidirOperacion({
  operacion,
  reporte,
  actor,
  payload,
  hoy,
  enlaceExistente,
  esCierreHistoricoSinEnlace,
  contraparteValida,
}: ParametrosDecisionOperacion): DecisionOperacion {
  // 1. Matriz de autorización por rol
  if (!esRolAutorizadoParaOperacion(operacion, actor.rol)) {
    return {
      tipo: 'error',
      status: 403,
      message: 'Operación administrativa no habilitada',
    };
  }

  // 2. Reporte archivado
  if (
    reporte.activo === false &&
    ['recepcion', 'devolucion', 'cierre', 'donacion', 'edicion'].includes(
      operacion,
    )
  ) {
    return {
      tipo: 'error',
      status: 409,
      message: 'No se puede operar sobre un reporte archivado',
    };
  }

  // 3. Compatibilidad tipo/ruta
  if (
    ['devolucion', 'donacion'].includes(operacion) &&
    reporte.tipo_reporte !== 'encontrado'
  ) {
    return {
      tipo: 'error',
      status: 400,
      message: 'Esta operación solo aplica a reportes encontrados',
    };
  }

  if (operacion === 'cierre' && reporte.tipo_reporte !== 'perdido') {
    return {
      tipo: 'error',
      status: 400,
      message: 'Esta operación solo aplica a reportes perdidos',
    };
  }

  // 4. Edición de reporte terminal activo
  if (
    operacion === 'edicion' &&
    reporte.activo === true &&
    ['devuelto', 'donado'].includes(reporte.estado)
  ) {
    return {
      tipo: 'error',
      status: 409,
      message: 'No se puede editar un reporte en estado terminal',
    };
  }

  // 5. Decisiones por operación
  switch (operacion) {
    case 'recepcion': {
      if (reporte.estado === 'en_servicios') {
        return {
          tipo: 'sin_efecto',
          respuesta: {
            cambiado: false,
            id: reporte.id,
            estado: 'En servicios',
          },
        };
      }
      if (reporte.estado === 'encontrado') {
        return {
          tipo: 'mutacion',
          cambios: { estado: 'en_servicios' },
          historial: [
            {
              accion: 'recepcion',
              valor_anterior: 'encontrado',
              valor_nuevo: 'en_servicios',
            },
          ],
          auditoria: { accion: 'recepcion_reporte' },
        };
      }
      return {
        tipo: 'error',
        status: 400,
        message: 'Transición de estado inválida',
      };
    }

    case 'devolucion': {
      if (reporte.estado === 'devuelto') {
        return {
          tipo: 'sin_efecto',
          respuesta: {
            cambiado: false,
            id: reporte.id,
            estado: 'Devuelto',
          },
        };
      }
      if (reporte.estado === 'en_servicios') {
        return {
          tipo: 'mutacion',
          cambios: { estado: 'devuelto' },
          historial: [
            {
              accion: 'devolucion',
              valor_anterior: 'en_servicios',
              valor_nuevo: 'devuelto',
            },
          ],
          auditoria: {
            accion: 'devolucion_reporte',
            detalles: payload as Record<string, unknown>,
          },
        };
      }
      if (reporte.estado === 'encontrado') {
        return {
          tipo: 'error',
          status: 400,
          message: 'El reporte debe ser recepcionado antes de ser devuelto',
        };
      }
      return {
        tipo: 'error',
        status: 400,
        message: 'Transición de estado inválida',
      };
    }

    case 'cierre': {
      if (reporte.estado === 'devuelto') {
        if (esCierreHistoricoSinEnlace) {
          return {
            tipo: 'sin_efecto',
            respuesta: {
              cambiado: false,
              id: reporte.id,
              estado: 'Devuelto',
              nota: 'Cierre anterior sin contraparte registrada',
            },
          };
        }
        const solicitud = (payload || {}) as Partial<SolicitudCierreReporte>;
        if (
          enlaceExistente &&
          solicitud.reporte_encontrado_id !== undefined &&
          enlaceExistente.reporte_encontrado_id === solicitud.reporte_encontrado_id
        ) {
          return {
            tipo: 'sin_efecto',
            respuesta: {
              cambiado: false,
              id: reporte.id,
              estado: 'Devuelto',
            },
          };
        }
        if (
          enlaceExistente &&
          solicitud.reporte_encontrado_id !== undefined &&
          enlaceExistente.reporte_encontrado_id !== solicitud.reporte_encontrado_id
        ) {
          return {
            tipo: 'error',
            status: 409,
            message: 'El reporte ya se encuentra vinculado a otra contraparte',
          };
        }
        return {
          tipo: 'sin_efecto',
          respuesta: {
            cambiado: false,
            id: reporte.id,
            estado: 'Devuelto',
            nota: 'Cierre anterior sin contraparte registrada',
          },
        };
      }
      if (reporte.estado === 'perdido') {
        const solicitud = (payload || {}) as Partial<SolicitudCierreReporte>;
        const detallesAuditoria: Record<string, unknown> = {};
        if (solicitud.reporte_encontrado_id) {
          detallesAuditoria.reporte_encontrado_id = solicitud.reporte_encontrado_id;
        }
        if (contraparteValida) {
          detallesAuditoria.reporte_encontrado_id = contraparteValida.reporte.id;
          detallesAuditoria.registro_devolucion_id = contraparteValida.entregaA10Id;
        }
        return {
          tipo: 'mutacion',
          cambios: { estado: 'devuelto' },
          historial: [
            {
              accion: 'cierre',
              valor_anterior: 'perdido',
              valor_nuevo: 'devuelto',
            },
          ],
          auditoria: {
            accion: 'cierre_reporte',
            detalles: Object.keys(detallesAuditoria).length > 0 ? detallesAuditoria : null,
          },
        };
      }
      return {
        tipo: 'error',
        status: 400,
        message: 'Transición de estado inválida',
      };
    }

    case 'donacion': {
      if (reporte.estado === 'donado') {
        return {
          tipo: 'sin_efecto',
          respuesta: {
            cambiado: false,
            id: reporte.id,
            estado: 'Donado',
          },
        };
      }
      if (reporte.estado === 'en_servicios') {
        return {
          tipo: 'mutacion',
          cambios: { estado: 'donado' },
          historial: [
            {
              accion: 'donacion',
              valor_anterior: 'en_servicios',
              valor_nuevo: 'donado',
            },
          ],
          auditoria: { accion: 'donacion_reporte' },
        };
      }
      if (reporte.estado === 'encontrado') {
        return {
          tipo: 'error',
          status: 400,
          message: 'El reporte debe ser recepcionado antes de ser donado',
        };
      }
      return {
        tipo: 'error',
        status: 400,
        message: 'Transición de estado inválida',
      };
    }

    case 'archivo': {
      if (reporte.activo === false) {
        return {
          tipo: 'sin_efecto',
          respuesta: { cambiado: false, id: reporte.id, activo: false },
        };
      }
      return {
        tipo: 'mutacion',
        cambios: { activo: false },
        historial: [
          {
            accion: 'archivo',
            valor_anterior: 'activo',
            valor_nuevo: 'inactivo',
          },
        ],
        auditoria: { accion: 'archivo_reporte' },
      };
    }

    case 'reactivacion': {
      if (reporte.activo === true) {
        return {
          tipo: 'sin_efecto',
          respuesta: { cambiado: false, id: reporte.id, activo: true },
        };
      }
      return {
        tipo: 'mutacion',
        cambios: { activo: true },
        historial: [
          {
            accion: 'reactivacion',
            valor_anterior: 'inactivo',
            valor_nuevo: 'activo',
          },
        ],
        auditoria: { accion: 'reactivacion_reporte' },
      };
    }

    case 'edicion': {
      const cambiosNormalizados = payload as Partial<DatosEdicionReporte>;
      const diferencias = obtenerDiferenciasEdicion(
        reporte,
        cambiosNormalizados,
      );

      if (diferencias.length === 0) {
        return {
          tipo: 'sin_efecto',
          respuesta: { actualizado: false, id: reporte.id },
        };
      }

      const cambiosParaUpdate: {
        -readonly [P in keyof FilaReporte]?: FilaReporte[P];
      } = {};
      for (const dif of diferencias) {
        if (dif.campo === 'ubicacion_id') {
          cambiosParaUpdate.ubicacion_id =
            dif.valor_nuevo != null ? Number(dif.valor_nuevo) : null;
        } else if (dif.campo === 'ubicacion_otro') {
          cambiosParaUpdate.ubicacion_otro = dif.valor_nuevo;
        } else if (dif.campo === 'categoria_id') {
          cambiosParaUpdate.categoria_id = Number(dif.valor_nuevo);
        } else {
          (cambiosParaUpdate as Record<string, unknown>)[dif.campo] =
            dif.valor_nuevo;
        }
      }

      return {
        tipo: 'mutacion',
        cambios: cambiosParaUpdate,
        historial: diferencias.map((dif) => ({
          accion: 'edicion',
          valor_anterior: JSON.stringify({
            campo: dif.campo,
            valor: dif.valor_anterior,
          }),
          valor_nuevo: JSON.stringify({
            campo: dif.campo,
            valor: dif.valor_nuevo,
          }),
        })),
        auditoria: {
          accion: 'edicion_reporte',
          detalles: { campos: diferencias.map((d) => d.campo) },
        },
      };
    }

    default:
      return {
        tipo: 'error',
        status: 400,
        message: 'Operación no soportada',
      };
  }
}

export {
  validarIdAlta,
  textoObligatorio,
  normalizarEntrada,
  resolverTipoEstado,
  validarFechaIncidente,
  presentarEstado,
  resolverFormaUbicacion,
  resolverUbicacionPorNombre,
  esTransicionValida,
  formatearEstadisticas,
  validarVerificacionDevolucion,
  validarFormaEdicion,
  validarFormaCierre,
  obtenerDiferenciasEdicion,
  validarFormaBasicaSolicitud,
  decidirOperacion,
};
