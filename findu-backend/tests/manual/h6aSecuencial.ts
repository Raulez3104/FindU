import {
  validarLecturaAptaH6a,
  validarOperadorH6a,
  validarPrimeraVerificacionH6a,
  validarRespuestaRecepcionH6a,
  validarVerificacionFinalH6a,
  type ContextoOperadorH6a,
  type LecturaReporteH6a,
  type RespuestaRecepcionH6a,
} from '../helpers/h6aSecuencial';

type ModoH6aSecuencial = 'inactivo' | 'ensayo' | 'ejecucion';

interface PreparacionH6aSecuencial {
  readonly operador: ContextoOperadorH6a;
  readonly lineaBase: LecturaReporteH6a;
}

interface DependenciasH6aSecuencial {
  preparar(): Promise<PreparacionH6aSecuencial>;
  enviarRecepcion(): Promise<RespuestaRecepcionH6a>;
  leerVerificacion(): Promise<unknown>;
}

type ResultadoArnesH6aSecuencial =
  | { readonly estado: 'inactivo' }
  | { readonly estado: 'ensayo_acreditado' }
  | { readonly estado: 'stop_previo' }
  | { readonly estado: 'stop_primera_respuesta' }
  | { readonly estado: 'stop_respuesta_incierta' }
  | { readonly estado: 'mutacion_confirmada_actualizacion_no_acreditada' }
  | { readonly estado: 'stop_segunda_respuesta' }
  | { readonly estado: 'secuencia_acreditada' };

function resolverModoH6aSecuencial(argumentos: readonly string[]): ModoH6aSecuencial {
  const permitidos = new Set(['--ensayo', '--ejecutar']);
  const noAdmitido = argumentos.find((argumento) => !permitidos.has(argumento));
  if (noAdmitido) {
    throw new Error(`Argumento no admitido: ${noAdmitido}`);
  }
  if (new Set(argumentos).size !== argumentos.length) {
    throw new Error('Los flags opt-in no se pueden repetir');
  }
  const ensayo = argumentos.includes('--ensayo');
  const ejecutar = argumentos.includes('--ejecutar');
  if (ejecutar && !ensayo) {
    throw new Error('La ejecución exige doble opt-in: --ensayo --ejecutar');
  }
  if (ejecutar) return 'ejecucion';
  if (ensayo) return 'ensayo';
  return 'inactivo';
}

async function prepararContexto(
  dependencias: DependenciasH6aSecuencial,
): Promise<PreparacionH6aSecuencial | null> {
  try {
    const preparacion = await dependencias.preparar();
    return {
      operador: validarOperadorH6a(preparacion.operador),
      lineaBase: validarLecturaAptaH6a(preparacion.lineaBase),
    };
  } catch (_error: unknown) {
    return null;
  }
}

async function ejecutarArnesH6aSecuencial(
  argumentos: readonly string[],
  dependencias: DependenciasH6aSecuencial,
): Promise<ResultadoArnesH6aSecuencial> {
  const modo = resolverModoH6aSecuencial(argumentos);
  if (modo === 'inactivo') return { estado: 'inactivo' };

  const preparacion = await prepararContexto(dependencias);
  if (!preparacion) return { estado: 'stop_previo' };
  if (modo === 'ensayo') return { estado: 'ensayo_acreditado' };

  let primeraRespuesta: RespuestaRecepcionH6a;
  try {
    primeraRespuesta = await dependencias.enviarRecepcion();
  } catch (_error: unknown) {
    return { estado: 'stop_respuesta_incierta' };
  }
  if (primeraRespuesta.tipo === 'incierta') {
    return { estado: 'stop_respuesta_incierta' };
  }
  try {
    validarRespuestaRecepcionH6a(primeraRespuesta, true);
  } catch (_error: unknown) {
    return { estado: 'stop_primera_respuesta' };
  }

  let primeraLectura: unknown;
  try {
    primeraLectura = await dependencias.leerVerificacion();
  } catch (_error: unknown) {
    return { estado: 'mutacion_confirmada_actualizacion_no_acreditada' };
  }

  let primeraVerificacion;
  try {
    primeraVerificacion = validarPrimeraVerificacionH6a(
      preparacion.lineaBase,
      primeraLectura,
      preparacion.operador.actor_id,
    );
  } catch (_error: unknown) {
    return { estado: 'mutacion_confirmada_actualizacion_no_acreditada' };
  }

  let segundaRespuesta: RespuestaRecepcionH6a;
  try {
    segundaRespuesta = await dependencias.enviarRecepcion();
    validarRespuestaRecepcionH6a(segundaRespuesta, false);
  } catch (_error: unknown) {
    return { estado: 'stop_segunda_respuesta' };
  }

  try {
    const lecturaFinal = await dependencias.leerVerificacion();
    validarVerificacionFinalH6a(
      primeraVerificacion,
      lecturaFinal,
      preparacion.operador.actor_id,
    );
  } catch (_error: unknown) {
    return { estado: 'stop_segunda_respuesta' };
  }

  return { estado: 'secuencia_acreditada' };
}

const dependenciasNoConfiguradas: DependenciasH6aSecuencial = {
  async preparar() {
    throw new Error('El adaptador operativo no está configurado');
  },
  async enviarRecepcion() {
    throw new Error('El adaptador operativo no está configurado');
  },
  async leerVerificacion() {
    throw new Error('El adaptador operativo no está configurado');
  },
};

if (require.main === module) {
  void ejecutarArnesH6aSecuencial(
    process.argv.slice(2),
    dependenciasNoConfiguradas,
  ).catch(() => undefined);
}

export { ejecutarArnesH6aSecuencial, resolverModoH6aSecuencial };
export type { DependenciasH6aSecuencial, ResultadoArnesH6aSecuencial };
