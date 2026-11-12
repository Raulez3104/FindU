import pool = require('../config/database');
import { ejecutarOperacionReporte } from '../services/servicioOperacionesReportes';
import type { FilaReporte, PerfilAdministrador } from '../types/modelos';

jest.mock('../config/database', () => ({
  connect: jest.fn(),
}));

const actor: PerfilAdministrador = {
  id: 7,
  nombre: 'Operador ficticio',
  correo: 'operador@example.invalid',
  rol: 'admin',
};

function reporte(
  id: number,
  tipo_reporte: FilaReporte['tipo_reporte'],
  estado: FilaReporte['estado'],
): FilaReporte {
  return {
    id,
    usuario_id: 1,
    administrador_id: null,
    tipo_autor: 'usuario',
    usuario_nombre: 'Autor ficticio',
    usuario_correo: 'autor@example.invalid',
    administrador_nombre: null,
    tipo_reporte,
    estado,
    activo: true,
    titulo: 'Objeto ficticio',
    descripcion: 'Descripción ficticia',
    contacto: 'Contacto ficticio',
    categoria_id: 1,
    categoria_nombre: 'Categoría ficticia',
    fecha_incidente: '2026-11-01',
    fecha: '2026-11-01 12:00',
    campus: 'principal',
    ubicacion_id: 1,
    ubicacion_nombre: 'Ubicación ficticia',
    ubicacion_otro: null,
    imagen: 'imagen-ficticia.jpg',
  };
}

function prepararCliente(respuestas: readonly { rows: unknown[] }[]) {
  const query = jest.fn()
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce(respuestas[0])
    .mockResolvedValueOnce(respuestas[1] ?? { rows: [] })
    .mockResolvedValueOnce({ rows: [] });
  const release = jest.fn();
  (pool.connect as jest.Mock).mockResolvedValueOnce({ query, release });
  return { query, release };
}

function exigirSoloLecturasYRollback(query: jest.Mock, release: jest.Mock): void {
  const sentencias = query.mock.calls.map(([sql]) => String(sql));
  expect(sentencias).toHaveLength(4);
  expect(sentencias[0]).toBe('BEGIN');
  expect(sentencias[3]).toBe('ROLLBACK');
  expect(sentencias.some((sql) => /^\s*(?:UPDATE|INSERT)\b/i.test(sql))).toBe(false);
  expect(release).toHaveBeenCalledTimes(1);
}

describe('regresión de no-ops tras retirar la instrumentación H6b', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('A15 conserva el cierre histórico sin enlace y no escribe', async () => {
    const perdido = reporte(101, 'perdido', 'devuelto');
    const { query, release } = prepararCliente([{ rows: [perdido] }, { rows: [] }]);

    await expect(
      ejecutarOperacionReporte({
        id: perdido.id,
        operacion: 'cierre',
        actor,
        payload: { reporte_encontrado_id: 201 },
      }),
    ).resolves.toEqual({
      cambiado: false,
      id: perdido.id,
      estado: 'Devuelto',
      nota: 'Cierre anterior sin contraparte registrada',
    });

    exigirSoloLecturasYRollback(query, release);
  });

  test('A13 conserva el reintento del mismo enlace y no escribe', async () => {
    const perdido = reporte(102, 'perdido', 'devuelto');
    const encontradoId = 202;
    const { query, release } = prepararCliente([
      { rows: [perdido] },
      {
        rows: [
          {
            detalles: {
              reporte_encontrado_id: encontradoId,
              registro_devolucion_id: 301,
            },
          },
        ],
      },
    ]);

    await expect(
      ejecutarOperacionReporte({
        id: perdido.id,
        operacion: 'cierre',
        actor,
        payload: { reporte_encontrado_id: encontradoId },
      }),
    ).resolves.toEqual({
      cambiado: false,
      id: perdido.id,
      estado: 'Devuelto',
    });

    exigirSoloLecturasYRollback(query, release);
  });

  test('la rama general sin efecto conserva su respuesta y no escribe', async () => {
    const encontrado = reporte(103, 'encontrado', 'en_servicios');
    const { query, release } = prepararCliente([{ rows: [encontrado] }]);

    await expect(
      ejecutarOperacionReporte({
        id: encontrado.id,
        operacion: 'recepcion',
        actor,
      }),
    ).resolves.toEqual({
      cambiado: false,
      id: encontrado.id,
      estado: 'En servicios',
    });

    const sentencias = query.mock.calls.map(([sql]) => String(sql));
    expect(sentencias).toHaveLength(3);
    expect(sentencias[0]).toBe('BEGIN');
    expect(sentencias[2]).toBe('ROLLBACK');
    expect(sentencias.some((sql) => /^\s*(?:UPDATE|INSERT)\b/i.test(sql))).toBe(false);
    expect(release).toHaveBeenCalledTimes(1);
  });
});
