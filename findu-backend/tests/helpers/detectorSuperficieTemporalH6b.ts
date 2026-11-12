type CategoriaSuperficieTemporalH6b =
  | 'fabrica-app'
  | 'transporte-controlador'
  | 'gates-servicio'
  | 'tipos-temporales'
  | 'helper-lifecycle'
  | 'arnes-manual'
  | 'contexto-composicion'
  | 'imports-exports-temporales';

interface FuenteInspeccionH6b {
  readonly ruta: string;
  readonly contenido: string;
}

interface HallazgoSuperficieTemporalH6b {
  readonly categoria: CategoriaSuperficieTemporalH6b;
  readonly ruta: string;
}

const detectores: readonly {
  readonly categoria: CategoriaSuperficieTemporalH6b;
  readonly coincide: (fuente: FuenteInspeccionH6b) => boolean;
}[] = [
  {
    categoria: 'fabrica-app',
    coincide: ({ ruta, contenido }) =>
      ruta === 'app.ts' && /crearAppTemporalH6b|ensamblarApp\(configuracionTemporalH6b/.test(contenido),
  },
  {
    categoria: 'transporte-controlador',
    coincide: ({ ruta, contenido }) =>
      ruta === 'controllers/adminController.ts' &&
      /leaseTemporalH6bRequest|consumirLeaseTemporalH6b/.test(contenido),
  },
  {
    categoria: 'gates-servicio',
    coincide: ({ ruta, contenido }) =>
      ruta === 'services/servicioOperacionesReportes.ts' &&
      /esperarPreBegin|esperarPreCommit|cierreTransaccional|ControlAdmisionH6b|ControlCommitH6b/.test(contenido),
  },
  {
    categoria: 'tipos-temporales',
    coincide: ({ contenido }) =>
      /(?:interface|type)\s+\w*LeaseTemporalH6b|cierreTransaccional/.test(contenido),
  },
  {
    categoria: 'helper-lifecycle',
    coincide: ({ ruta, contenido }) =>
      ruta === 'tests/helpers/ejecucionControladaH6b.ts' && /class LeaseControlado/.test(contenido),
  },
  {
    categoria: 'arnes-manual',
    coincide: ({ ruta, contenido }) =>
      ruta === 'tests/manual/cierreConcurrenciaH6b.ts' && /ejecutarArnesH6b/.test(contenido),
  },
  {
    categoria: 'contexto-composicion',
    coincide: ({ contenido }) => /ConfiguracionAppTemporalH6b|ContextoCausalH6b/.test(contenido),
  },
  {
    categoria: 'imports-exports-temporales',
    coincide: ({ contenido }) =>
      /(?:import|export)[\s\S]{0,160}(?:LeaseTemporalH6b|crearAppTemporalH6b|ejecucionControladaH6b)/.test(
        contenido,
      ),
  },
];

function detectarSuperficieTemporalH6b(
  fuentes: readonly FuenteInspeccionH6b[],
): readonly HallazgoSuperficieTemporalH6b[] {
  return detectores.flatMap((detector) => {
    const fuente = fuentes.find(detector.coincide);
    return fuente ? [{ categoria: detector.categoria, ruta: fuente.ruta }] : [];
  });
}

function exigirAusenciaSuperficieTemporalH6b(
  fuentes: readonly FuenteInspeccionH6b[],
): void {
  const hallazgos = detectarSuperficieTemporalH6b(fuentes);
  if (hallazgos.length > 0) {
    throw new Error(
      `Permanece superficie temporal H6b: ${hallazgos
        .map(({ categoria, ruta }) => `${categoria}@${ruta}`)
        .join(', ')}`,
    );
  }
}

export { detectarSuperficieTemporalH6b, exigirAusenciaSuperficieTemporalH6b };
export type {
  CategoriaSuperficieTemporalH6b,
  FuenteInspeccionH6b,
  HallazgoSuperficieTemporalH6b,
};
