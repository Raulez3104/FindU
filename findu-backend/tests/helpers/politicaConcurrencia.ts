type ModoPruebaConcurrencia = 'suite-ordinaria' | 'integracion-controlada';

interface EvidenciaReporteConcurrencia {
  readonly anonimizado: boolean;
  readonly excepcionAutoriaPropiaVinculada?: {
    readonly reporteId: number;
    readonly contenidoExclusivamenteDePrueba: boolean;
  };
  readonly sinUsoOperativo: boolean;
  readonly autorizadoParaRetencion: boolean;
  readonly estadoEsperado: 'encontrado';
  readonly activoEsperado: true;
}

interface SolicitudPruebaConcurrencia {
  readonly modo: ModoPruebaConcurrencia;
  readonly reporteId?: number;
  readonly evidencia: EvidenciaReporteConcurrencia;
}

interface PrerequisitosRechazados {
  readonly autorizadoParaReservar: false;
  readonly motivo: string;
}

interface PrerequisitosAprobados {
  readonly autorizadoParaReservar: true;
  readonly reporteId: number;
  readonly estadoEsperado: 'encontrado';
  readonly activoEsperado: true;
}

type ResultadoPrerequisitos = PrerequisitosRechazados | PrerequisitosAprobados;

interface IdentificadoresConexiones {
  readonly operacionA: number;
  readonly operacionB: number;
  readonly verificacion: number;
}

interface SolicitudAutorizacionMutacion {
  readonly prerequisitos: ResultadoPrerequisitos;
  readonly reservaAtomicaAdquirida: boolean;
  readonly conexiones: IdentificadoresConexiones;
}

function rechazar(motivo: string): PrerequisitosRechazados {
  return { autorizadoParaReservar: false, motivo };
}

function evaluarPrerequisitosConcurrencia(
  solicitud: SolicitudPruebaConcurrencia,
): ResultadoPrerequisitos {
  if (solicitud.modo !== 'integracion-controlada') {
    return rechazar('La concurrencia con retención no se ejecuta en la suite ordinaria');
  }
  return rechazar(
    'La integración controlada H6a está retirada y requiere un plan nuevo aprobado',
  );
}

function validarConexionesFisicas(conexiones: IdentificadoresConexiones): number[] {
  const identificadores = [
    conexiones.operacionA,
    conexiones.operacionB,
    conexiones.verificacion,
  ];
  const sonIdentificadoresValidos = identificadores.every(
    (identificador) => Number.isInteger(identificador) && identificador > 0,
  );
  if (!sonIdentificadoresValidos || new Set(identificadores).size !== 3) {
    throw new Error(
      'La prueba requiere tres conexiones físicas distintas acreditadas con pg_backend_pid()',
    );
  }
  return identificadores;
}

function autorizarMutacionConReserva({
  prerequisitos,
  reservaAtomicaAdquirida,
  conexiones,
}: SolicitudAutorizacionMutacion): { reporteId: number; conexiones: number[] } {
  if (!prerequisitos.autorizadoParaReservar) {
    throw new Error(prerequisitos.motivo);
  }
  if (!reservaAtomicaAdquirida) {
    throw new Error('No se adquirió una reserva atómica real para el reporte aprobado');
  }

  return {
    reporteId: prerequisitos.reporteId,
    conexiones: validarConexionesFisicas(conexiones),
  };
}

export {
  autorizarMutacionConReserva,
  evaluarPrerequisitosConcurrencia,
  validarConexionesFisicas,
};
export type { SolicitudPruebaConcurrencia };
