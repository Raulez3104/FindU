jest.mock('../config/database', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

import request = require('supertest');
import jwt = require('jsonwebtoken');
import app = require('../app');
import pool = require('../config/database');

const poolMock = pool as unknown as { query: jest.Mock; connect: jest.Mock };

const JWT_SECRET = 'secreto-de-prueba';

beforeAll(() => {
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.JWT_EXPIRACION_HORAS = '24';
});

function emitirToken(rol: string = 'admin', id: number = 1): string {
  return jwt.sign(
    { sub: String(id), rol, ambito: 'administrador' },
    JWT_SECRET,
    { issuer: 'FindU', expiresIn: '1h' },
  );
}

function emitirTokenEstudiante(): string {
  return jwt.sign(
    { sub: '99', ambito: 'estudiante' },
    JWT_SECRET,
    { issuer: 'FindU', expiresIn: '1h' },
  );
}

describe('GET /administradores/reportes/:id/candidatos-cierre (V4-T3 / A13)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    poolMock.query.mockReset();
  });

  test('401 si no se envía cabecera de autenticación', async () => {
    const res = await request(app).get('/administradores/reportes/10/candidatos-cierre');
    expect(res.status).toBe(401);
  });

  test('403 si el token es de estudiante', async () => {
    const token = emitirTokenEstudiante();
    const res = await request(app)
      .get('/administradores/reportes/10/candidatos-cierre')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('404 si el ID de ruta no es un entero positivo válido', async () => {
    const token = emitirToken('admin');
    poolMock.query.mockResolvedValueOnce({
      rows: [{ id: 1, nombre: 'Admin', correo: 'a@u.test', rol: 'admin', activo: true }],
    });
    const res = await request(app)
      .get('/administradores/reportes/abc/candidatos-cierre')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('404 si el reporte perdido no existe en base de datos', async () => {
    const token = emitirToken('admin');
    // Mock para validar cuenta del admin en authMiddleware
    poolMock.query
      .mockResolvedValueOnce({
        rows: [{ id: 1, nombre: 'Admin', correo: 'a@u.test', rol: 'admin', activo: true }],
      })
      // Mock para buscar si el reporte perdido existe
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/administradores/reportes/999/candidatos-cierre')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/Reporte no encontrado/i);
  });

  test('200 retorna candidatos proyectados sin exponer A10, receptor ni JSONB', async () => {
    const token = emitirToken('personal_servicios', 2);
    // 1. Auth middleware admin check
    poolMock.query.mockResolvedValueOnce({
      rows: [{ id: 2, nombre: 'Personal', correo: 'p@u.test', rol: 'personal_servicios', activo: true }],
    });
    // 2. Comprobar existencia del perdido
    poolMock.query.mockResolvedValueOnce({
      rows: [{ id: 10, tipo_reporte: 'perdido', estado: 'perdido', activo: true }],
    });
    // 3. Consulta de candidatos devueltos con entrega A10
    poolMock.query.mockResolvedValueOnce({
      rows: [
        {
          id: 50,
          titulo: 'Mochila negra',
          estado: 'devuelto',
          fecha: '2026-11-05',
          campus: 'Central',
          ubicacion: 'Biblioteca',
          detalles_entrega: {
            nombre_receptor: 'Persona ficticia',
            referencia_comprobante: 'Verificación ficticia',
          },
          archivado: false,
          usado: false,
        },
        {
          id: 45,
          titulo: 'Audífonos Sony',
          estado: 'devuelto',
          fecha: '2026-11-03',
          campus: 'Central',
          ubicacion: null,
          detalles_entrega: {
            nombre_receptor: 'Otra persona ficticia',
            referencia_comprobante: 'Otra verificación ficticia',
          },
          archivado: true,
          usado: true,
        },
      ],
    });

    const res = await request(app)
      .get('/administradores/reportes/10/candidatos-cierre')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);

    const primer = res.body[0];
    expect(primer).toEqual({
      id: 50,
      titulo: 'Mochila negra',
      estado: 'Devuelto',
      fecha: '2026-11-05',
      campus: 'Central',
      ubicacion: 'Biblioteca',
      archivado: false,
      usado: false,
    });

    // Validar minimización estricta: NO receptor, NO datos personales, NO JSONB
    for (const candidato of res.body) {
      expect(candidato.nombre_receptor).toBeUndefined();
      expect(candidato.referencia_comprobante).toBeUndefined();
      expect(candidato.observacion).toBeUndefined();
      expect(candidato.detalles).toBeUndefined();
      expect(candidato.verificacion_devolucion).toBeUndefined();
      expect(candidato.contacto).toBeUndefined();
    }
  });

  test('aplica filtro de búsqueda por título o ID si se proporciona query', async () => {
    const token = emitirToken('admin');
    poolMock.query.mockResolvedValueOnce({
      rows: [{ id: 1, nombre: 'Admin', correo: 'a@u.test', rol: 'admin', activo: true }],
    });
    poolMock.query.mockResolvedValueOnce({
      rows: [{ id: 10, tipo_reporte: 'perdido', estado: 'perdido', activo: true }],
    });
    poolMock.query.mockResolvedValueOnce({
      rows: [
        {
          id: 50,
          titulo: 'Mochila negra',
          estado: 'devuelto',
          fecha: '2026-11-05',
          campus: 'Central',
          ubicacion: 'Biblioteca',
          detalles_entrega: {
            nombre_receptor: 'Persona ficticia',
            referencia_comprobante: 'Verificación ficticia',
          },
          archivado: false,
          usado: false,
        },
      ],
    });

    const res = await request(app)
      .get('/administradores/reportes/10/candidatos-cierre?busqueda=mochila')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].titulo).toBe('Mochila negra');
  });

  test('proyecta fecha de creación sin consultar columnas inexistentes', async () => {
    const token = emitirToken('admin');
    poolMock.query.mockResolvedValueOnce({
      rows: [{ id: 1, nombre: 'Admin', correo: 'a@u.test', rol: 'admin', activo: true }],
    });
    poolMock.query.mockResolvedValueOnce({ rows: [{ id: 10 }] });
    poolMock.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/administradores/reportes/10/candidatos-cierre')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const consultaCandidatos = String(poolMock.query.mock.calls[2]?.[0]);
    expect(consultaCandidatos).toContain("TO_CHAR(r.fecha_creacion, 'YYYY-MM-DD HH24:MI') AS fecha");
    expect(consultaCandidatos).not.toContain('r.fecha)');
    expect(consultaCandidatos).toContain('ORDER BY ra.id ASC');
  });
});
