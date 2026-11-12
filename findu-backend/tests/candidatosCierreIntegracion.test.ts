import 'dotenv/config';

import pool = require('../config/database');
import { consultarCandidatosCierre } from '../services/servicioOperacionesReportes';
import { conTransaccionPrueba } from './helpers/dbTransaccion';

afterAll(() => pool.end());

describe('consulta real de candidatos de cierre', () => {
  test('ejecuta la proyección tipada contra el esquema canónico aplicado', () =>
    conTransaccionPrueba(async (client) => {
      await client.query('SET TRANSACTION READ ONLY');
      const reporte = await client.query<{ id: number }>(
        'SELECT id FROM reportes ORDER BY id ASC LIMIT 1',
      );

      if (reporte.rows.length === 0) {
        throw new Error('La BD aplicada no contiene un reporte para comprobar la consulta de solo lectura');
      }

      const candidatos = await consultarCandidatosCierre(Number(reporte.rows[0].id));

      for (const candidato of candidatos) {
        expect(Object.keys(candidato).sort()).toEqual([
          'archivado', 'campus', 'estado', 'fecha', 'id', 'titulo', 'ubicacion', 'usado',
        ]);
        expect(candidato.id).toEqual(expect.any(Number));
        expect(candidato.titulo).toEqual(expect.any(String));
        expect(candidato.estado).toBe('Devuelto');
        expect(candidato.fecha).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
        expect(candidato.campus).toEqual(expect.any(String));
        expect(candidato.ubicacion === null || typeof candidato.ubicacion === 'string').toBe(true);
        expect(candidato.archivado).toEqual(expect.any(Boolean));
        expect(candidato.usado).toEqual(expect.any(Boolean));
      }
    }));
});
