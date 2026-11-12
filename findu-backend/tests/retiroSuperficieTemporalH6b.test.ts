import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

import {
  detectarSuperficieTemporalH6b,
  exigirAusenciaSuperficieTemporalH6b,
} from './helpers/detectorSuperficieTemporalH6b';

describe('H6B-T8: retiro total de la superficie temporal H6b', () => {
  test('exige ausencia absoluta de superficie temporal en código de producción', () => {
    const rutas = [
      'app.ts',
      'controllers/adminController.ts',
      'services/servicioOperacionesReportes.ts',
      'config/database.ts',
      'routes/adminRoutes.ts',
      'routes/reportRoutes.ts',
    ];
    const fuentes = rutas.map((ruta) => ({
      ruta,
      contenido: readFileSync(resolve(__dirname, '..', ruta), 'utf8'),
    }));
    exigirAusenciaSuperficieTemporalH6b(fuentes);
  });

  test('exige eliminación física de todos los archivos y arneses temporales de prueba', () => {
    const archivosTemporales = [
      'tests/helpers/ejecucionControladaH6b.ts',
      'tests/manual/cierreConcurrenciaH6b.ts',
      'tests/integracionLeaseTemporalH6b.test.ts',
      'tests/ejecucionControladaH6b.test.ts',
      'tests/arnesManualH6b.test.ts',
    ];
    for (const archivo of archivosTemporales) {
      const rutaAbsoluta = resolve(__dirname, '..', archivo);
      expect(existsSync(rutaAbsoluta)).toBe(false);
    }
  });
});

