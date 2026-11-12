import fs from 'node:fs';
import path from 'node:path';

import {
  autorizarMutacionConReserva,
  evaluarPrerequisitosConcurrencia,
  validarConexionesFisicas,
  type SolicitudPruebaConcurrencia,
} from './helpers/politicaConcurrencia';

type SolicitudControlada = 'A' | 'B';
type EtapaConexionControlada = 'autenticacion' | 'transaccion';
type TipoFalloControlado = 'error_observador' | 'timeout';

interface AtribucionControlada {
  readonly solicitud: SolicitudControlada;
  readonly etapa: EtapaConexionControlada;
  readonly pid: number;
}

interface EscenarioCleanupAnterior {
  readonly atribuciones: readonly AtribucionControlada[];
  readonly fallo: TipoFalloControlado;
  readonly solicitudesPendientes: readonly SolicitudControlada[];
  readonly cancelacionHttpSolicitada?: boolean;
  readonly solicitudesEsperadasAntesDeLiberar?: boolean;
  readonly transaccionesServicioCanceladas?: boolean;
}

interface DiagnosticoCleanupAnterior {
  readonly cantidadAtribuciones: number;
  readonly atribucionesTransaccionalesInequivocas: boolean;
  readonly liberoReservaConSolicitudesPendientes: boolean;
  readonly mutacionSigueSiendoPosibleTrasStop: boolean;
  readonly cancelacionHttpAcreditaCancelacionSql: boolean;
}

interface EvidenciaEstrategiaFailClosed {
  readonly aplicacionReal: boolean;
  readonly autenticacionLegitima: boolean;
  readonly postgresqlReal: boolean;
  readonly clientesTransaccionalesAtribuidos: boolean;
  readonly operacionesIncapacesDeMutarDuranteGuardas: boolean;
  readonly cancelacionTransaccionalConfirmada: boolean;
  readonly solicitudesFinalizadasAntesDeLiberar: boolean;
}

interface EvaluacionEstrategiaFailClosed {
  readonly decision: 'CONTINUAR' | 'STOP';
  readonly faltantes: readonly string[];
  readonly acreditaRf22: false;
}

function reproducirCleanupAnterior(
  escenario: EscenarioCleanupAnterior,
): DiagnosticoCleanupAnterior {
  const atribucionesTransaccionales = escenario.atribuciones.filter(
    ({ etapa }) => etapa === 'transaccion',
  );
  const solicitudesAtribuidas = new Set(
    atribucionesTransaccionales.map(({ solicitud }) => solicitud),
  );
  const pidsTransaccionales = new Set(
    atribucionesTransaccionales.map(({ pid }) => pid),
  );
  const atribucionesTransaccionalesInequivocas =
    escenario.atribuciones.length === 2 &&
    atribucionesTransaccionales.length === 2 &&
    solicitudesAtribuidas.size === 2 &&
    pidsTransaccionales.size === 2;
  const solicitudesFinalizadas = escenario.solicitudesPendientes.length === 0;
  const esperaCompletaAntesDeLiberar =
    escenario.solicitudesEsperadasAntesDeLiberar === true &&
    solicitudesFinalizadas;
  const liberoReservaConSolicitudesPendientes =
    !esperaCompletaAntesDeLiberar && !solicitudesFinalizadas;
  const cancelacionTransaccionalConfirmada =
    escenario.cancelacionHttpSolicitada === true &&
    escenario.transaccionesServicioCanceladas === true;

  return {
    cantidadAtribuciones: escenario.atribuciones.length,
    atribucionesTransaccionalesInequivocas,
    liberoReservaConSolicitudesPendientes,
    mutacionSigueSiendoPosibleTrasStop:
      liberoReservaConSolicitudesPendientes &&
      !cancelacionTransaccionalConfirmada,
    cancelacionHttpAcreditaCancelacionSql:
      cancelacionTransaccionalConfirmada,
  };
}

function evaluarEstrategiaFailClosed(
  evidencia: EvidenciaEstrategiaFailClosed,
): EvaluacionEstrategiaFailClosed {
  const requisitos: readonly [keyof EvidenciaEstrategiaFailClosed, string][] = [
    ['aplicacionReal', 'aplicación real'],
    ['autenticacionLegitima', 'autenticación legítima'],
    ['postgresqlReal', 'PostgreSQL real'],
    [
      'clientesTransaccionalesAtribuidos',
      'PoolClient transaccional de cada recepción',
    ],
    [
      'operacionesIncapacesDeMutarDuranteGuardas',
      'barrera previa a la mutación',
    ],
    ['cancelacionTransaccionalConfirmada', 'cancelación transaccional causal'],
    [
      'solicitudesFinalizadasAntesDeLiberar',
      'espera de solicitudes propias antes de liberar',
    ],
  ];
  const faltantes = requisitos.flatMap(([requisito, descripcion]) =>
    evidencia[requisito] ? [] : [descripcion],
  );

  return {
    decision: faltantes.length === 0 ? 'CONTINUAR' : 'STOP',
    faltantes,
    acreditaRf22: false,
  };
}

const solicitudAptaAnterior: SolicitudPruebaConcurrencia = {
  modo: 'integracion-controlada',
  reporteId: 501,
  evidencia: {
    anonimizado: true,
    sinUsoOperativo: true,
    autorizadoParaRetencion: true,
    estadoEsperado: 'encontrado',
    activoEsperado: true,
  },
};

const solicitudAutoriaPropiaAnterior: SolicitudPruebaConcurrencia = {
  modo: 'integracion-controlada',
  reporteId: 11994,
  evidencia: {
    anonimizado: false,
    excepcionAutoriaPropiaVinculada: {
      reporteId: 11994,
      contenidoExclusivamenteDePrueba: true,
    },
    sinUsoOperativo: true,
    autorizadoParaRetencion: true,
    estadoEsperado: 'encontrado',
    activoEsperado: true,
  },
};

describe('T9-1: retiro fail-closed de la instrumentación temporal H6a', () => {
  const raizBackend = path.resolve(__dirname, '..');
  const rechazoEsperado = {
    autorizadoParaReservar: false,
    motivo:
      'La integración controlada H6a está retirada y requiere un plan nuevo aprobado',
  };

  test('la aplicación y el pool no conservan hooks temporales de observación', () => {
    const fuenteApp = fs.readFileSync(path.join(raizBackend, 'app.ts'), 'utf8');
    const fuenteBaseDatos = fs.readFileSync(
      path.join(raizBackend, 'config', 'database.ts'),
      'utf8',
    );

    expect(fuenteApp).not.toMatch(
      /crearAplicacion|observadorRecepcion|ejecutarConEtiquetaConexionPrueba/,
    );
    expect(fuenteBaseDatos).not.toMatch(
      /AsyncLocalStorage|instalarObservadorConexionPrueba|ejecutarConEtiquetaConexionPrueba|conectarObservado/,
    );
  });

  test('el arnés y su helper exclusivos ya no existen en fuente', () => {
    expect(
      fs.existsSync(
        path.join(raizBackend, 'tests', 'manual', 'concurrenciaH6a.ts'),
      ),
    ).toBe(false);
    expect(
      fs.existsSync(
        path.join(
          raizBackend,
          'tests',
          'helpers',
          'arnesConcurrenciaH6a.ts',
        ),
      ),
    ).toBe(false);
  });

  test.each([
    ['recurso anónimo anterior', solicitudAptaAnterior],
    ['reporte consumido #11994', solicitudAutoriaPropiaAnterior],
    [
      'reporte histórico #11995',
      { ...solicitudAptaAnterior, reporteId: 11995 },
    ],
    [
      'reporte consumido #4075',
      { ...solicitudAptaAnterior, reporteId: 4075 },
    ],
    [
      'candidato futuro #12752',
      {
        ...solicitudAutoriaPropiaAnterior,
        reporteId: 12752,
        evidencia: {
          ...solicitudAutoriaPropiaAnterior.evidencia,
          excepcionAutoriaPropiaVinculada: {
            reporteId: 12752,
            contenidoExclusivamenteDePrueba: true,
          },
        },
      },
    ],
  ])('rechaza fail-closed toda integración controlada: %s', (_caso, solicitud) => {
    expect(evaluarPrerequisitosConcurrencia(solicitud)).toEqual(rechazoEsperado);
  });
});

describe('006B T17: puerta segura para la prueba controlada de concurrencia', () => {
  test('la suite ordinaria permanece bloqueada sin seleccionar ni mutar reportes', () => {
    expect(
      evaluarPrerequisitosConcurrencia({
        ...solicitudAptaAnterior,
        modo: 'suite-ordinaria',
      }),
    ).toEqual({
      autorizadoParaReservar: false,
      motivo: 'La concurrencia con retención no se ejecuta en la suite ordinaria',
    });
  });

  test('conserva la validación pura de conexiones físicas', () => {
    expect(() =>
      validarConexionesFisicas({
        operacionA: 7101,
        operacionB: 7102,
        verificacion: 7102,
      }),
    ).toThrow('tres conexiones físicas distintas');

    expect(
      validarConexionesFisicas({
        operacionA: 7101,
        operacionB: 7102,
        verificacion: 7103,
      }),
    ).toEqual([7101, 7102, 7103]);
  });

  test('el rechazo fail-closed no puede convertirse en autorización de mutación', () => {
    const prerequisitos = evaluarPrerequisitosConcurrencia(solicitudAptaAnterior);

    expect(() =>
      autorizarMutacionConReserva({
        prerequisitos,
        reservaAtomicaAdquirida: true,
        conexiones: {
          operacionA: 7101,
          operacionB: 7102,
          verificacion: 7103,
        },
      }),
    ).toThrow(
      'La integración controlada H6a está retirada y requiere un plan nuevo aprobado',
    );
  });
});

describe('T9-2: reproducción unitaria no mutante del límite fail-closed', () => {
  const atribucionTransaccionalA: AtribucionControlada = {
    solicitud: 'A',
    etapa: 'transaccion',
    pid: 8101,
  };
  const atribucionTransaccionalB: AtribucionControlada = {
    solicitud: 'B',
    etapa: 'transaccion',
    pid: 8102,
  };

  test.each([
    ['cero por autenticación retrasada', []],
    ['una por pool retrasado', [atribucionTransaccionalA]],
    [
      'más de dos por mezclar autenticación y transacción',
      [
        { solicitud: 'A', etapa: 'autenticacion', pid: 8001 },
        atribucionTransaccionalA,
        atribucionTransaccionalB,
      ] satisfies readonly AtribucionControlada[],
    ],
  ])(
    'libera la reserva con solicitudes pendientes ante %s atribuciones',
    (_caso, atribuciones) => {
      const diagnostico = reproducirCleanupAnterior({
        atribuciones,
        fallo: 'timeout',
        solicitudesPendientes: ['A', 'B'],
      });

      expect(diagnostico.cantidadAtribuciones).toBe(atribuciones.length);
      expect(diagnostico.atribucionesTransaccionalesInequivocas).toBe(false);
      expect(diagnostico.liberoReservaConSolicitudesPendientes).toBe(true);
      expect(diagnostico.mutacionSigueSiendoPosibleTrasStop).toBe(true);
    },
  );

  test('un error del observador antes de atribuir conexiones conserva el mismo riesgo', () => {
    const diagnostico = reproducirCleanupAnterior({
      atribuciones: [],
      fallo: 'error_observador',
      solicitudesPendientes: ['A', 'B'],
    });

    expect(diagnostico.liberoReservaConSolicitudesPendientes).toBe(true);
    expect(diagnostico.mutacionSigueSiendoPosibleTrasStop).toBe(true);
  });

  test('cancelar HTTP y revertir la reserva no cancelan la transacción propia del servicio', () => {
    const diagnostico = reproducirCleanupAnterior({
      atribuciones: [atribucionTransaccionalA],
      fallo: 'timeout',
      solicitudesPendientes: ['A', 'B'],
      cancelacionHttpSolicitada: true,
      transaccionesServicioCanceladas: false,
    });

    expect(diagnostico.cancelacionHttpAcreditaCancelacionSql).toBe(false);
    expect(diagnostico.mutacionSigueSiendoPosibleTrasStop).toBe(true);
  });

  test('dos atribuciones solo son válidas si ambas identifican clientes transaccionales distintos', () => {
    const diagnostico = reproducirCleanupAnterior({
      atribuciones: [
        { solicitud: 'A', etapa: 'autenticacion', pid: 8001 },
        atribucionTransaccionalB,
      ],
      fallo: 'timeout',
      solicitudesPendientes: ['A', 'B'],
    });

    expect(diagnostico.cantidadAtribuciones).toBe(2);
    expect(diagnostico.atribucionesTransaccionalesInequivocas).toBe(false);
  });

  test('esperar solicitudes y confirmar cancelación transaccional evita liberar con trabajo pendiente en el modelo', () => {
    const diagnostico = reproducirCleanupAnterior({
      atribuciones: [atribucionTransaccionalA, atribucionTransaccionalB],
      fallo: 'timeout',
      solicitudesPendientes: [],
      cancelacionHttpSolicitada: true,
      solicitudesEsperadasAntesDeLiberar: true,
      transaccionesServicioCanceladas: true,
    });

    expect(diagnostico.atribucionesTransaccionalesInequivocas).toBe(true);
    expect(diagnostico.liberoReservaConSolicitudesPendientes).toBe(false);
    expect(diagnostico.mutacionSigueSiendoPosibleTrasStop).toBe(false);
  });

  test('las dependencias controladas no acreditan aplicación, auth, PoolClient PostgreSQL ni RF-22', () => {
    const evaluacion = evaluarEstrategiaFailClosed({
      aplicacionReal: false,
      autenticacionLegitima: false,
      postgresqlReal: false,
      clientesTransaccionalesAtribuidos: false,
      operacionesIncapacesDeMutarDuranteGuardas: true,
      cancelacionTransaccionalConfirmada: true,
      solicitudesFinalizadasAntesDeLiberar: true,
    });

    expect(evaluacion.decision).toBe('STOP');
    expect(evaluacion.acreditaRf22).toBe(false);
    expect(evaluacion.faltantes).toEqual(
      expect.arrayContaining([
        'aplicación real',
        'autenticación legítima',
        'PostgreSQL real',
        'PoolClient transaccional de cada recepción',
      ]),
    );
  });

  test('la estrategia futura queda en STOP si no demuestra toda la frontera causal antes de liberar', () => {
    const evaluacion = evaluarEstrategiaFailClosed({
      aplicacionReal: true,
      autenticacionLegitima: true,
      postgresqlReal: true,
      clientesTransaccionalesAtribuidos: true,
      operacionesIncapacesDeMutarDuranteGuardas: false,
      cancelacionTransaccionalConfirmada: false,
      solicitudesFinalizadasAntesDeLiberar: false,
    });

    expect(evaluacion.decision).toBe('STOP');
    expect(evaluacion.faltantes).toEqual(
      expect.arrayContaining([
        'barrera previa a la mutación',
        'cancelación transaccional causal',
        'espera de solicitudes propias antes de liberar',
      ]),
    );
    expect(evaluacion.acreditaRf22).toBe(false);
  });
});
