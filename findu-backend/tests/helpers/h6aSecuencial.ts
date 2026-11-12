const REPORTE_H6A_ID = 12752;
const ENTERO_POSTGRES_MAXIMO = 2147483647;

type RolMutanteH6a = 'admin' | 'personal_servicios';
type EstadoLecturaH6a = 'encontrado' | 'en_servicios';

interface LecturaReporteH6a {
  readonly id: number;
  readonly tipo_reporte: 'encontrado';
  readonly estado: EstadoLecturaH6a;
  readonly activo: true;
  readonly historial_recepcion: number;
  readonly auditoria_recepcion: number;
}

interface FilaHistorialRecepcionH6a {
  readonly id: number;
  readonly reporte_id: number;
  readonly accion: 'recepcion';
  readonly valor_anterior: 'encontrado';
  readonly valor_nuevo: 'en_servicios';
}

interface FilaAuditoriaRecepcionH6a {
  readonly id: number;
  readonly administrador_id: number;
  readonly accion: 'recepcion_reporte';
  readonly tabla_destino: 'reportes';
  readonly id_destino: number;
}

interface LecturaVerificacionH6a extends LecturaReporteH6a {
  readonly historial_nuevo: readonly FilaHistorialRecepcionH6a[];
  readonly auditoria_nueva: readonly FilaAuditoriaRecepcionH6a[];
}

interface ContextoOperadorH6a {
  readonly actor_id: number;
  readonly rol: RolMutanteH6a;
}

type RespuestaRecepcionH6a =
  | {
      readonly tipo: 'confirmada';
      readonly status: number;
      readonly cuerpo: unknown;
    }
  | {
      readonly tipo: 'incierta';
    };

interface RespuestaRecepcionConfirmadaH6a {
  readonly cambiado: boolean;
  readonly id: typeof REPORTE_H6A_ID;
  readonly estado: 'En servicios';
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function exigirObjetoExacto(
  valor: unknown,
  claves: readonly string[],
  nombre: string,
): Record<string, unknown> {
  if (!esObjeto(valor)) {
    throw new Error(`${nombre} debe ser un objeto`);
  }
  const recibidas = Object.keys(valor).sort();
  const esperadas = [...claves].sort();
  if (
    recibidas.length !== esperadas.length ||
    recibidas.some((clave, indice) => clave !== esperadas[indice])
  ) {
    throw new Error(`${nombre} tiene una forma inválida`);
  }
  return valor;
}

function exigirId(valor: unknown, nombre: string): number {
  if (
    typeof valor !== 'number' ||
    !Number.isInteger(valor) ||
    valor < 1 ||
    valor > ENTERO_POSTGRES_MAXIMO
  ) {
    throw new Error(`${nombre} debe ser un entero positivo válido`);
  }
  return valor;
}

function exigirConteo(valor: unknown, nombre: string): number {
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 0) {
    throw new Error(`${nombre} debe ser un entero no negativo`);
  }
  return valor;
}

function validarLecturaComun(
  lectura: unknown,
  estadoEsperado: EstadoLecturaH6a,
): LecturaReporteH6a {
  const datos = exigirObjetoExacto(
    lectura,
    [
      'id',
      'tipo_reporte',
      'estado',
      'activo',
      'historial_recepcion',
      'auditoria_recepcion',
    ],
    'La lectura H6a',
  );
  if (datos.id !== REPORTE_H6A_ID) {
    throw new Error(`H6a solo admite el reporte #${REPORTE_H6A_ID}`);
  }
  if (datos.tipo_reporte !== 'encontrado') {
    throw new Error('El reporte H6a debe ser de tipo encontrado');
  }
  if (datos.estado !== estadoEsperado) {
    throw new Error(`El reporte H6a debe estar en estado ${estadoEsperado}`);
  }
  if (datos.activo !== true) {
    throw new Error('El reporte H6a debe tener activo=true');
  }
  exigirConteo(datos.historial_recepcion, 'historial_recepcion');
  exigirConteo(datos.auditoria_recepcion, 'auditoria_recepcion');
  return datos as unknown as LecturaReporteH6a;
}

function validarLecturaAptaH6a(lectura: unknown): LecturaReporteH6a {
  return validarLecturaComun(lectura, 'encontrado');
}

function validarOperadorH6a(operador: unknown): ContextoOperadorH6a {
  const datos = exigirObjetoExacto(operador, ['actor_id', 'rol'], 'El operador H6a');
  exigirId(datos.actor_id, 'actor_id');
  if (datos.rol !== 'admin' && datos.rol !== 'personal_servicios') {
    throw new Error('El operador H6a no tiene un rol mutante permitido');
  }
  return datos as unknown as ContextoOperadorH6a;
}

function validarRespuestaRecepcionH6a(
  respuesta: RespuestaRecepcionH6a,
  cambiadoEsperado: boolean,
): RespuestaRecepcionConfirmadaH6a {
  if (respuesta.tipo !== 'confirmada') {
    throw new Error('La respuesta de recepción es incierta');
  }
  if (respuesta.status !== 200) {
    throw new Error('La recepción no respondió HTTP 200');
  }
  const cuerpo = exigirObjetoExacto(
    respuesta.cuerpo,
    ['cambiado', 'id', 'estado'],
    'La respuesta de recepción',
  );
  if (
    cuerpo.cambiado !== cambiadoEsperado ||
    cuerpo.id !== REPORTE_H6A_ID ||
    cuerpo.estado !== 'En servicios'
  ) {
    throw new Error('La respuesta de recepción no coincide con la secuencia esperada');
  }
  return cuerpo as unknown as RespuestaRecepcionConfirmadaH6a;
}

function validarFilaHistorial(valor: unknown): FilaHistorialRecepcionH6a {
  const fila = exigirObjetoExacto(
    valor,
    ['id', 'reporte_id', 'accion', 'valor_anterior', 'valor_nuevo'],
    'La fila nueva de historial',
  );
  exigirId(fila.id, 'historial.id');
  if (
    fila.reporte_id !== REPORTE_H6A_ID ||
    fila.accion !== 'recepcion' ||
    fila.valor_anterior !== 'encontrado' ||
    fila.valor_nuevo !== 'en_servicios'
  ) {
    throw new Error('La fila nueva de historial no acredita la recepción H6a');
  }
  return fila as unknown as FilaHistorialRecepcionH6a;
}

function validarFilaAuditoria(
  valor: unknown,
  actorId: number,
): FilaAuditoriaRecepcionH6a {
  const fila = exigirObjetoExacto(
    valor,
    ['id', 'administrador_id', 'accion', 'tabla_destino', 'id_destino'],
    'La fila nueva de auditoría',
  );
  exigirId(fila.id, 'auditoria.id');
  if (
    fila.administrador_id !== actorId ||
    fila.accion !== 'recepcion_reporte' ||
    fila.tabla_destino !== 'reportes' ||
    fila.id_destino !== REPORTE_H6A_ID
  ) {
    throw new Error('La fila nueva de auditoría no acredita actor y destino H6a');
  }
  return fila as unknown as FilaAuditoriaRecepcionH6a;
}

function validarLecturaPosterior(
  lectura: unknown,
  actorId: number,
): LecturaVerificacionH6a {
  const datos = exigirObjetoExacto(
    lectura,
    [
      'id',
      'tipo_reporte',
      'estado',
      'activo',
      'historial_recepcion',
      'auditoria_recepcion',
      'historial_nuevo',
      'auditoria_nueva',
    ],
    'La verificación H6a',
  );
  const lecturaComun = validarLecturaComun(
    {
      id: datos.id,
      tipo_reporte: datos.tipo_reporte,
      estado: datos.estado,
      activo: datos.activo,
      historial_recepcion: datos.historial_recepcion,
      auditoria_recepcion: datos.auditoria_recepcion,
    },
    'en_servicios',
  );
  if (!Array.isArray(datos.historial_nuevo) || datos.historial_nuevo.length !== 1) {
    throw new Error('H6a exige exactamente una fila nueva de historial');
  }
  if (!Array.isArray(datos.auditoria_nueva) || datos.auditoria_nueva.length !== 1) {
    throw new Error('H6a exige exactamente una fila nueva de auditoría');
  }
  return {
    ...lecturaComun,
    historial_nuevo: [validarFilaHistorial(datos.historial_nuevo[0])],
    auditoria_nueva: [validarFilaAuditoria(datos.auditoria_nueva[0], actorId)],
  };
}

function validarPrimeraVerificacionH6a(
  lineaBase: LecturaReporteH6a,
  lectura: unknown,
  actorId: number,
): LecturaVerificacionH6a {
  const verificacion = validarLecturaPosterior(lectura, actorId);
  if (
    verificacion.historial_recepcion !== lineaBase.historial_recepcion + 1 ||
    verificacion.auditoria_recepcion !== lineaBase.auditoria_recepcion + 1
  ) {
    throw new Error('La primera recepción no produjo deltas exactos +1/+1');
  }
  return verificacion;
}

function validarVerificacionFinalH6a(
  primera: LecturaVerificacionH6a,
  lectura: unknown,
  actorId: number,
): LecturaVerificacionH6a {
  const final = validarLecturaPosterior(lectura, actorId);
  if (
    final.historial_recepcion !== primera.historial_recepcion ||
    final.auditoria_recepcion !== primera.auditoria_recepcion ||
    final.historial_nuevo[0].id !== primera.historial_nuevo[0].id ||
    final.auditoria_nueva[0].id !== primera.auditoria_nueva[0].id
  ) {
    throw new Error('El segundo POST produjo escrituras o filas distintas');
  }
  return final;
}

export {
  REPORTE_H6A_ID,
  validarLecturaAptaH6a,
  validarOperadorH6a,
  validarPrimeraVerificacionH6a,
  validarRespuestaRecepcionH6a,
  validarVerificacionFinalH6a,
};
export type {
  ContextoOperadorH6a,
  LecturaReporteH6a,
  LecturaVerificacionH6a,
  RespuestaRecepcionH6a,
};
