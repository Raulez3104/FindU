import 'dotenv/config';

import request = require('supertest');
import path = require('path');
import jwt = require('jsonwebtoken');

import app = require('../app');
import pool = require('../config/database');
import { conTransaccionPrueba } from './helpers/dbTransaccion';
import { randomInt, randomUUID } from 'crypto';

interface FixtureAuth {
  readonly tokenSuperadmin: string;
  readonly tokenAdmin: string;
  readonly tokenServicios: string;
  readonly tokenEstudiante: string;
  readonly categoriaId: number;
  readonly ubicacionId: number;
  readonly campus: string;
  readonly adminId: number;
  readonly usuarioId: number;
}

const JWT_SECRET = 'secreto-de-prueba-mutaciones';

beforeAll(() => {
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.JWT_EXPIRACION_HORAS = '24';
});

afterAll(() => {
  return pool.end();
});

function emitirTokenAdmin(id: number, rol: string): string {
  return jwt.sign({ sub: String(id), ambito: 'administrador', rol }, JWT_SECRET, {
    issuer: 'FindU',
    expiresIn: '24h',
  });
}

function emitirTokenEstudiante(id: number): string {
  return jwt.sign({ sub: String(id), ambito: 'estudiante' }, JWT_SECRET, {
    issuer: 'FindU',
    expiresIn: '24h',
  });
}

async function prepararFixtures(client: any): Promise<FixtureAuth> {
  const marca = `t5-${randomUUID()}`;
  const id = () => randomInt(1000000000, 2000000000);

  const superId = id();
  await client.query(
    'INSERT INTO administradores (id, nombre, correo, contrasena, rol, activo) VALUES ($1, $2, $3, $4, $5, TRUE)',
    [superId, `${marca}-super`, `${marca}.super@example.invalid`, 'hash', 'superadmin'],
  );

  const adminId = id();
  await client.query(
    'INSERT INTO administradores (id, nombre, correo, contrasena, rol, activo) VALUES ($1, $2, $3, $4, $5, TRUE)',
    [adminId, `${marca}-admin`, `${marca}.admin@example.invalid`, 'hash', 'admin'],
  );

  const servId = id();
  await client.query(
    'INSERT INTO administradores (id, nombre, correo, contrasena, rol, activo) VALUES ($1, $2, $3, $4, $5, TRUE)',
    [servId, `${marca}-serv`, `${marca}.serv@example.invalid`, 'hash', 'personal_servicios'],
  );

  const catId = id();
  await client.query(
    'INSERT INTO categorias (id, nombre, activo) VALUES ($1, $2, TRUE)',
    [catId, `${marca}-cat`],
  );

  const ubiId = id();
  await client.query(
    'INSERT INTO ubicaciones (id, nombre, campus, activo) VALUES ($1, $2, $3, TRUE)',
    [ubiId, `${marca}-ubi`, marca],
  );

  const usuarioId = id();
  await client.query(
    'INSERT INTO usuarios (id, nombre, correo) VALUES ($1, $2, $3)',
    [usuarioId, `${marca}-estudiante`, `${marca}.est@example.invalid`],
  );

  return {
    tokenSuperadmin: emitirTokenAdmin(superId, 'superadmin'),
    tokenAdmin: emitirTokenAdmin(adminId, 'admin'),
    tokenServicios: emitirTokenAdmin(servId, 'personal_servicios'),
    tokenEstudiante: emitirTokenEstudiante(usuarioId),
    categoriaId: catId,
    ubicacionId: ubiId,
    campus: marca,
    adminId,
    usuarioId,
  };
}

describe('006A T5: Alta administrativa auditada (POST /administradores/reportes)', () => {
  const bufferFoto = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;');

  test('auth y RBAC preceden a Multer: sin token es 401, estudiante/superadmin es 403', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);

      // Sin token -> 401
      const resSinToken = await request(app)
        .post('/administradores/reportes')
        .attach('image', bufferFoto, 'foto.png');
      expect(resSinToken.status).toBe(401);

      // Estudiante -> 403
      const resEstudiante = await request(app)
        .post('/administradores/reportes')
        .set('Authorization', `Bearer ${fixtures.tokenEstudiante}`)
        .attach('image', bufferFoto, 'foto.png');
      expect(resEstudiante.status).toBe(403);

      // Superadmin -> 403 (solo admin y personal_servicios tienen alta)
      const resSuper = await request(app)
        .post('/administradores/reportes')
        .set('Authorization', `Bearer ${fixtures.tokenSuperadmin}`)
        .attach('image', bufferFoto, 'foto.png');
      expect(resSuper.status).toBe(403);
    }));

  test('admin y personal_servicios crean hallazgo en_servicios con 201 y auditoría atómica', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);

      for (const token of [fixtures.tokenAdmin, fixtures.tokenServicios]) {
        const respuesta = await request(app)
          .post('/administradores/reportes')
          .set('Authorization', `Bearer ${token}`)
          .field('tipo_reporte', 'encontrado')
          .field('titulo', 'Mochila hallada en biblioteca')
          .field('descripcion', 'Azul con libros')
          .field('contacto', 'servicios@example.test')
          .field('categoria_id', String(fixtures.categoriaId))
          .field('fecha_incidente', '2026-11-01')
          .field('campus', fixtures.campus)
          .field('ubicacion_id', String(fixtures.ubicacionId))
          .attach('image', bufferFoto, 'foto.png');

        expect(respuesta.status).toBe(201);
        expect(respuesta.body).toEqual({
          message: 'Reporte creado exitosamente',
          id: expect.any(Number),
          imagen: expect.any(String),
          imageUrl: expect.stringMatching(/^\/uploads\//),
          estado: 'En servicios',
        });

        const idReporte = respuesta.body.id;

        // Verificar reporte en BD
        const fila = (await client.query('SELECT estado, tipo_reporte, administrador_id, usuario_id FROM reportes WHERE id = $1', [idReporte])).rows[0];
        expect(fila.estado).toBe('en_servicios');
        expect(fila.tipo_reporte).toBe('encontrado');
        expect(fila.usuario_id).toBeNull();
        expect(fila.administrador_id).toBeTruthy();

        // Verificar historial
        const hist = (await client.query('SELECT accion, valor_anterior, valor_nuevo, tipo_realizado_por FROM historial WHERE reporte_id = $1', [idReporte])).rows;
        expect(hist).toHaveLength(1);
        expect(hist[0]).toEqual({
          accion: 'creacion',
          valor_anterior: null,
          valor_nuevo: 'en_servicios',
          tipo_realizado_por: 'admin',
        });

        // Verificar registro_administradores
        const reg = (await client.query('SELECT accion, tabla_destino, id_destino FROM registro_administradores WHERE id_destino = $1', [idReporte])).rows;
        expect(reg).toHaveLength(1);
        expect(reg[0]).toEqual({
          accion: 'creacion_reporte_administrativo',
          tabla_destino: 'reportes',
          id_destino: idReporte,
        });
      }
    }));

  test('rechaza con 400 cuando tipo_reporte es perdido o foto ausente', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);

      // perdido no permitido a admin
      const resPerdido = await request(app)
        .post('/administradores/reportes')
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .field('tipo_reporte', 'perdido')
        .field('titulo', 'Mochila')
        .field('descripcion', 'Azul')
        .field('contacto', 'servicios@example.test')
        .field('categoria_id', String(fixtures.categoriaId))
        .field('fecha_incidente', '2026-11-01')
        .field('campus', fixtures.campus)
        .field('ubicacion_id', String(fixtures.ubicacionId))
        .attach('image', bufferFoto, 'foto.png');

      expect(resPerdido.status).toBe(400);

      // Sin foto
      const resSinFoto = await request(app)
        .post('/administradores/reportes')
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .field('tipo_reporte', 'encontrado')
        .field('titulo', 'Mochila')
        .field('descripcion', 'Azul')
        .field('contacto', 'servicios@example.test')
        .field('categoria_id', String(fixtures.categoriaId))
        .field('fecha_incidente', '2026-11-01')
        .field('campus', fixtures.campus)
        .field('ubicacion_id', String(fixtures.ubicacionId));

      expect(resSinFoto.status).toBe(400);
    }));
});

describe('006A T6: Recepción y traza base (POST .../recepcion y GET .../historial)', () => {
  async function crearReporteParaRecepcion(
    client: any,
    fixtures: FixtureAuth,
    { tipo = 'encontrado', estado = 'encontrado', activo = true } = {},
  ): Promise<number> {
    const id = randomInt(1000000000, 2000000000);
    await client.query(
      `INSERT INTO reportes (
         id, usuario_id, administrador_id, titulo, descripcion, contacto, categoria_id,
         fecha_incidente, campus, ubicacion_id, tipo_reporte, estado, activo, imagen
       ) VALUES (
         $1, $2, NULL, 'Objeto encontrado para recepción', 'Desc', 'c@test', $3,
         '2026-11-01', $4, $5, $6, $7, $8, 'img.png'
       )`,
      [id, fixtures.usuarioId, fixtures.categoriaId, fixtures.campus, fixtures.ubicacionId, tipo, estado, activo],
    );
    if (estado !== 'encontrado' && estado !== 'perdido') {
      if (tipo === 'encontrado' && (estado === 'devuelto' || estado === 'donado')) {
        await client.query("UPDATE reportes SET estado = 'en_servicios' WHERE id = $1", [id]);
      }
      await client.query('UPDATE reportes SET estado = $1 WHERE id = $2', [estado, id]);
    }
    return id;
  }

  test('recepción: auth, RBAC, precedencia de ID y cuerpo', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);
      const reporteId = await crearReporteParaRecepcion(client, fixtures);

      // 401 sin token
      const resSinToken = await request(app).post(`/administradores/reportes/${reporteId}/recepcion`);
      expect(resSinToken.status).toBe(401);

      // 403 estudiante
      const resEst = await request(app)
        .post(`/administradores/reportes/${reporteId}/recepcion`)
        .set('Authorization', `Bearer ${fixtures.tokenEstudiante}`);
      expect(resEst.status).toBe(403);

      // 403 superadmin
      const resSuper = await request(app)
        .post(`/administradores/reportes/${reporteId}/recepcion`)
        .set('Authorization', `Bearer ${fixtures.tokenSuperadmin}`);
      expect(resSuper.status).toBe(403);

      // 404 ID inválido
      const resIdInv = await request(app)
        .post('/administradores/reportes/no-entero/recepcion')
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`);
      expect(resIdInv.status).toBe(404);

      // 400 si envía cuerpo con claves
      const resConCuerpo = await request(app)
        .post(`/administradores/reportes/${reporteId}/recepcion`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({ campo_extra: 'invalido' });
      expect(resConCuerpo.status).toBe(400);
    }));

  test('recepción: mutación 200 y no-op 200 repetido', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);
      const reporteId = await crearReporteParaRecepcion(client, fixtures, { estado: 'encontrado' });

      // Primera recepción: mutación a en_servicios
      const res1 = await request(app)
        .post(`/administradores/reportes/${reporteId}/recepcion`)
        .set('Authorization', `Bearer ${fixtures.tokenServicios}`)
        .send({});
      expect(res1.status).toBe(200);
      expect(res1.body).toEqual({
        cambiado: true,
        id: reporteId,
        estado: 'En servicios',
      });

      // Segunda recepción: no-op 200 sin efectos
      const res2 = await request(app)
        .post(`/administradores/reportes/${reporteId}/recepcion`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({});
      expect(res2.status).toBe(200);
      expect(res2.body).toEqual({
        cambiado: false,
        id: reporteId,
        estado: 'En servicios',
      });
    }));

  test('recepción: 409 archivado y 400 tipo perdido', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);

      const archivadoId = await crearReporteParaRecepcion(client, fixtures, { activo: false });
      const resArchivado = await request(app)
        .post(`/administradores/reportes/${archivadoId}/recepcion`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`);
      expect(resArchivado.status).toBe(409);

      const perdidoId = await crearReporteParaRecepcion(client, fixtures, { tipo: 'perdido', estado: 'perdido' });
      const resPerdido = await request(app)
        .post(`/administradores/reportes/${perdidoId}/recepcion`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`);
      expect(resPerdido.status).toBe(400);
    }));

  test('traza GET /administradores/reportes/:id/historial: auth, RBAC y respuesta estructurada', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);
      const reporteId = await crearReporteParaRecepcion(client, fixtures);

      // Realizar una recepción para generar fila de historial
      await request(app)
        .post(`/administradores/reportes/${reporteId}/recepcion`)
        .set('Authorization', `Bearer ${fixtures.tokenServicios}`);

      // 401 sin token
      const resSinToken = await request(app).get(`/administradores/reportes/${reporteId}/historial`);
      expect(resSinToken.status).toBe(401);

      // 403 estudiante
      const resEst = await request(app)
        .get(`/administradores/reportes/${reporteId}/historial`)
        .set('Authorization', `Bearer ${fixtures.tokenEstudiante}`);
      expect(resEst.status).toBe(403);

      // 404 ID inválido o inexistente
      const res404 = await request(app)
        .get('/administradores/reportes/abc/historial')
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`);
      expect(res404.status).toBe(404);

      // 200 accesible a superadmin, admin y personal_servicios
      for (const token of [fixtures.tokenSuperadmin, fixtures.tokenAdmin, fixtures.tokenServicios]) {
        const res = await request(app)
          .get(`/administradores/reportes/${reporteId}/historial`)
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          historial: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(Number),
              accion: 'recepcion',
              valor_anterior: 'encontrado',
              valor_nuevo: 'en_servicios',
              realizado_por: expect.any(Number),
              tipo_realizado_por: 'admin',
              realizado_por_nombre: expect.any(String),
              fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/),
            }),
          ]),
          verificacion_devolucion: null,
          enlace_cierre: null,
          nota_cierre_historico: null,
        });
      }
    }));

  test('T11: POST /administradores/reportes/:id/devolucion (auth, A10, 400, 409, 200 y no-op)', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);
      const reporteId = await crearReporteParaRecepcion(client, fixtures, { estado: 'en_servicios' });

      const cuerpoA10Valido = {
        nombre_receptor: 'Estudiante Receptor',
        referencia_comprobante: 'Credencial universitaria vigente',
        observacion: 'Entregado en ventanilla central',
        usuario_id: fixtures.usuarioId,
      };

      // 401 sin token
      const resSinToken = await request(app)
        .post(`/administradores/reportes/${reporteId}/devolucion`)
        .send(cuerpoA10Valido);
      expect(resSinToken.status).toBe(401);

      // 403 estudiante y superadmin
      const resEst = await request(app)
        .post(`/administradores/reportes/${reporteId}/devolucion`)
        .set('Authorization', `Bearer ${fixtures.tokenEstudiante}`)
        .send(cuerpoA10Valido);
      expect(resEst.status).toBe(403);

      const resSuper = await request(app)
        .post(`/administradores/reportes/${reporteId}/devolucion`)
        .set('Authorization', `Bearer ${fixtures.tokenSuperadmin}`)
        .send(cuerpoA10Valido);
      expect(resSuper.status).toBe(403);

      // 404 ID inválido
      const resIdInvalido = await request(app)
        .post('/administradores/reportes/abc/devolucion')
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send(cuerpoA10Valido);
      expect(resIdInvalido.status).toBe(404);

      // 400 A10 incompleta (falta referencia)
      const resIncompleta = await request(app)
        .post(`/administradores/reportes/${reporteId}/devolucion`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({ nombre_receptor: 'Solo Nombre' });
      expect(resIncompleta.status).toBe(400);

      // 400 usuario_id inexistente
      const resUsuarioInexistente = await request(app)
        .post(`/administradores/reportes/${reporteId}/devolucion`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({ ...cuerpoA10Valido, usuario_id: 999999999 });
      expect(resUsuarioInexistente.status).toBe(400);

      // 200 mutación exitosa con personal_servicios
      const resDev = await request(app)
        .post(`/administradores/reportes/${reporteId}/devolucion`)
        .set('Authorization', `Bearer ${fixtures.tokenServicios}`)
        .send(cuerpoA10Valido);
      expect(resDev.status).toBe(200);
      expect(resDev.body).toEqual({
        cambiado: true,
        id: reporteId,
        estado: 'Devuelto',
      });

      // Traza debe contener la verificación de devolución A10
      const resTraza = await request(app)
        .get(`/administradores/reportes/${reporteId}/historial`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`);
      expect(resTraza.status).toBe(200);
      expect(resTraza.body.verificacion_devolucion).toEqual({
        nombre_receptor: 'Estudiante Receptor',
        referencia_comprobante: 'Credencial universitaria vigente',
        observacion: 'Entregado en ventanilla central',
        usuario_id: fixtures.usuarioId,
      });

      // No-op 200 con cambiado: false
      const resNoOp = await request(app)
        .post(`/administradores/reportes/${reporteId}/devolucion`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send(cuerpoA10Valido);
      expect(resNoOp.status).toBe(200);
      expect(resNoOp.body).toEqual({
        cambiado: false,
        id: reporteId,
        estado: 'Devuelto',
      });
    }));

  test('T11/A13: POST /administradores/reportes/:id/cierre (auth, RBAC, forma, enlace contraparte, 400, 409, 200 y no-op)', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);
      const perdidoId = await crearReporteParaRecepcion(client, fixtures, { tipo: 'perdido', estado: 'perdido' });

      // Crear un encontrado y devolverlo con A10 para que sea contraparte válida
      const encontradoId = await crearReporteParaRecepcion(client, fixtures, { tipo: 'encontrado', estado: 'en_servicios' });
      await request(app)
        .post(`/administradores/reportes/${encontradoId}/devolucion`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({
          nombre_receptor: 'Receptor Encontrado',
          referencia_comprobante: 'Credencial Universitaria',
        });

      // 401 sin token
      const resSinToken = await request(app).post(`/administradores/reportes/${perdidoId}/cierre`);
      expect(resSinToken.status).toBe(401);

      // 403 superadmin y estudiante
      const resSuper = await request(app)
        .post(`/administradores/reportes/${perdidoId}/cierre`)
        .set('Authorization', `Bearer ${fixtures.tokenSuperadmin}`)
        .send({ reporte_encontrado_id: encontradoId });
      expect(resSuper.status).toBe(403);

      const resEst = await request(app)
        .post(`/administradores/reportes/${perdidoId}/cierre`)
        .set('Authorization', `Bearer ${fixtures.tokenEstudiante}`)
        .send({ reporte_encontrado_id: encontradoId });
      expect(resEst.status).toBe(403);

      // 404 ID inválido
      const resIdInvalido = await request(app)
        .post('/administradores/reportes/abc/cierre')
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({ reporte_encontrado_id: encontradoId });
      expect(resIdInvalido.status).toBe(404);

      // 400 cuerpo sin reporte_encontrado_id (A13 exige forma válida antes de consultar)
      const resCuerpoVacio = await request(app)
        .post(`/administradores/reportes/${perdidoId}/cierre`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({});
      expect(resCuerpoVacio.status).toBe(400);

      // 400 reporte URL no es tipo perdido (es encontrado)
      const resNoPerdido = await request(app)
        .post(`/administradores/reportes/${encontradoId}/cierre`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({ reporte_encontrado_id: encontradoId });
      expect(resNoPerdido.status).toBe(400);

      // 400 contraparte inexistente
      const resContraparteInexistente = await request(app)
        .post(`/administradores/reportes/${perdidoId}/cierre`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({ reporte_encontrado_id: 99999999 });
      expect(resContraparteInexistente.status).toBe(400);

      // 200 cierre exitoso por personal_servicios con contraparte válida
      const resCierre = await request(app)
        .post(`/administradores/reportes/${perdidoId}/cierre`)
        .set('Authorization', `Bearer ${fixtures.tokenServicios}`)
        .send({ reporte_encontrado_id: encontradoId });
      expect(resCierre.status).toBe(200);
      expect(resCierre.body).toEqual({
        cambiado: true,
        id: perdidoId,
        estado: 'Devuelto',
      });

      // 200 no-op al repetir sobre reporte ya devuelto con el mismo enlace
      const resNoOp = await request(app)
        .post(`/administradores/reportes/${perdidoId}/cierre`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({ reporte_encontrado_id: encontradoId });
      expect(resNoOp.status).toBe(200);
      expect(resNoOp.body).toEqual({
        cambiado: false,
        id: perdidoId,
        estado: 'Devuelto',
      });

      // 409 al intentar reasignar con otra contraparte
      const resReasignar = await request(app)
        .post(`/administradores/reportes/${perdidoId}/cierre`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({ reporte_encontrado_id: 11111111 });
      expect(resReasignar.status).toBe(409);
    }));

  test('T12: POST /administradores/reportes/:id/donacion (exclusivo admin, RBAC, 400, 409, 200 y no-op)', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);
      const reporteId = await crearReporteParaRecepcion(client, fixtures, { estado: 'en_servicios' });

      // 401 sin token
      const resSinToken = await request(app).post(`/administradores/reportes/${reporteId}/donacion`);
      expect(resSinToken.status).toBe(401);

      // 403 estudiante, superadmin Y personal_servicios (solo admin puede donar)
      const resEst = await request(app)
        .post(`/administradores/reportes/${reporteId}/donacion`)
        .set('Authorization', `Bearer ${fixtures.tokenEstudiante}`);
      expect(resEst.status).toBe(403);

      const resSuper = await request(app)
        .post(`/administradores/reportes/${reporteId}/donacion`)
        .set('Authorization', `Bearer ${fixtures.tokenSuperadmin}`);
      expect(resSuper.status).toBe(403);

      const resServ = await request(app)
        .post(`/administradores/reportes/${reporteId}/donacion`)
        .set('Authorization', `Bearer ${fixtures.tokenServicios}`);
      expect(resServ.status).toBe(403);

      // 404 ID inválido
      const resIdInvalido = await request(app)
        .post('/administradores/reportes/abc/donacion')
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`);
      expect(resIdInvalido.status).toBe(404);

      // 400 si envía cuerpo con claves no permitidas
      const resCuerpoInvalido = await request(app)
        .post(`/administradores/reportes/${reporteId}/donacion`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({ motivo: 'beneficencia' });
      expect(resCuerpoInvalido.status).toBe(400);

      // 400 si el reporte es de tipo perdido
      const perdidoId = await crearReporteParaRecepcion(client, fixtures, { tipo: 'perdido', estado: 'perdido' });
      const resPerdido = await request(app)
        .post(`/administradores/reportes/${perdidoId}/donacion`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`);
      expect(resPerdido.status).toBe(400);

      // 400 si el reporte es encontrado pero no ha sido recepcionado a en_servicios
      const sinRecepcionarId = await crearReporteParaRecepcion(client, fixtures, { estado: 'encontrado' });
      const resSinRecepcionar = await request(app)
        .post(`/administradores/reportes/${sinRecepcionarId}/donacion`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`);
      expect(resSinRecepcionar.status).toBe(400);

      // 409 si el reporte está archivado
      const archivadoId = await crearReporteParaRecepcion(client, fixtures, { estado: 'en_servicios', activo: false });
      const resArchivado = await request(app)
        .post(`/administradores/reportes/${archivadoId}/donacion`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`);
      expect(resArchivado.status).toBe(409);

      // 200 donación exitosa por admin
      const resDonacion = await request(app)
        .post(`/administradores/reportes/${reporteId}/donacion`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({});
      expect(resDonacion.status).toBe(200);
      expect(resDonacion.body).toEqual({
        cambiado: true,
        id: reporteId,
        estado: 'Donado',
      });

      // 200 no-op repetido sobre reporte ya donado
      const resNoOp = await request(app)
        .post(`/administradores/reportes/${reporteId}/donacion`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({});
      expect(resNoOp.status).toBe(200);
      expect(resNoOp.body).toEqual({
        cambiado: false,
        id: reporteId,
        estado: 'Donado',
      });
    }));

  test('T13: PATCH /administradores/reportes/:id (edición auditada, inmutables 400, terminal/archivado 409, 200 y no-op)', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);
      const reporteId = await crearReporteParaRecepcion(client, fixtures, { estado: 'en_servicios' });

      // 401 sin token
      const resSinToken = await request(app).patch(`/administradores/reportes/${reporteId}`).send({ titulo: 'Nuevo' });
      expect(resSinToken.status).toBe(401);

      // 403 estudiante y superadmin
      const resEst = await request(app)
        .patch(`/administradores/reportes/${reporteId}`)
        .set('Authorization', `Bearer ${fixtures.tokenEstudiante}`)
        .send({ titulo: 'Nuevo' });
      expect(resEst.status).toBe(403);

      const resSuper = await request(app)
        .patch(`/administradores/reportes/${reporteId}`)
        .set('Authorization', `Bearer ${fixtures.tokenSuperadmin}`)
        .send({ titulo: 'Nuevo' });
      expect(resSuper.status).toBe(403);

      // 404 ID inválido
      const resIdInvalido = await request(app)
        .patch('/administradores/reportes/abc')
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({ titulo: 'Nuevo' });
      expect(resIdInvalido.status).toBe(404);

      // 400 cuerpo vacío
      const resVacio = await request(app)
        .patch(`/administradores/reportes/${reporteId}`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({});
      expect(resVacio.status).toBe(400);

      // 400 campos prohibidos (foto / inmutables)
      const resFoto = await request(app)
        .patch(`/administradores/reportes/${reporteId}`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({ imagen: 'nueva_foto.jpg' });
      expect(resFoto.status).toBe(400);

      const resEstado = await request(app)
        .patch(`/administradores/reportes/${reporteId}`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({ estado: 'devuelto' });
      expect(resEstado.status).toBe(400);

      // 400 fecha futura
      const resFechaFutura = await request(app)
        .patch(`/administradores/reportes/${reporteId}`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({ fecha_incidente: '2099-12-31' });
      expect(resFechaFutura.status).toBe(400);

      // 409 reporte archivado
      const archivadoId = await crearReporteParaRecepcion(client, fixtures, { estado: 'en_servicios', activo: false });
      const resArchivado = await request(app)
        .patch(`/administradores/reportes/${archivadoId}`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({ titulo: 'Edición imposible' });
      expect(resArchivado.status).toBe(409);

      // 409 reporte terminal activo (devuelto)
      const terminalId = await crearReporteParaRecepcion(client, fixtures, { estado: 'devuelto', activo: true });
      const resTerminal = await request(app)
        .patch(`/administradores/reportes/${terminalId}`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({ titulo: 'Edición en terminal' });
      expect(resTerminal.status).toBe(409);

      // 200 edición exitosa con personal_servicios
      const resEdicion = await request(app)
        .patch(`/administradores/reportes/${reporteId}`)
        .set('Authorization', `Bearer ${fixtures.tokenServicios}`)
        .send({
          titulo: 'Título modificado auditado',
          descripcion: 'Descripción actualizada con trazabilidad',
        });
      expect(resEdicion.status).toBe(200);
      expect(resEdicion.body).toEqual({
        actualizado: true,
        id: reporteId,
      });

      // 200 no-op al enviar exactamente los mismos valores
      const resNoOp = await request(app)
        .patch(`/administradores/reportes/${reporteId}`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({
          titulo: 'Título modificado auditado',
          descripcion: 'Descripción actualizada con trazabilidad',
        });
      expect(resNoOp.status).toBe(200);
      expect(resNoOp.body).toEqual({
        actualizado: false,
        id: reporteId,
      });
    }));

  test('T14: POST /administradores/reportes/:id/archivo y /reactivacion (auth, preserva terminal, 200 y no-op)', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);
      const terminalId = await crearReporteParaRecepcion(client, fixtures, { estado: 'devuelto', activo: true });

      // 401 sin token
      const resSinToken = await request(app).post(`/administradores/reportes/${terminalId}/archivo`);
      expect(resSinToken.status).toBe(401);

      // 403 estudiante y superadmin
      const resEst = await request(app)
        .post(`/administradores/reportes/${terminalId}/archivo`)
        .set('Authorization', `Bearer ${fixtures.tokenEstudiante}`);
      expect(resEst.status).toBe(403);

      const resSuper = await request(app)
        .post(`/administradores/reportes/${terminalId}/archivo`)
        .set('Authorization', `Bearer ${fixtures.tokenSuperadmin}`);
      expect(resSuper.status).toBe(403);

      // 404 ID inválido
      const resIdInvalido = await request(app)
        .post('/administradores/reportes/abc/archivo')
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`);
      expect(resIdInvalido.status).toBe(404);

      // 400 cuerpo con contenido
      const resCuerpoInvalido = await request(app)
        .post(`/administradores/reportes/${terminalId}/archivo`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({ dato: 'extra' });
      expect(resCuerpoInvalido.status).toBe(400);

      // 200 archivo exitoso por personal_servicios sobre reporte terminal (conserva devuelto)
      const resArchivo = await request(app)
        .post(`/administradores/reportes/${terminalId}/archivo`)
        .set('Authorization', `Bearer ${fixtures.tokenServicios}`)
        .send({});
      expect(resArchivo.status).toBe(200);
      expect(resArchivo.body).toEqual({
        cambiado: true,
        id: terminalId,
        activo: false,
      });

      const filaArchivada = (await client.query('SELECT estado, activo FROM reportes WHERE id = $1', [terminalId])).rows[0];
      expect(filaArchivada.estado).toBe('devuelto');
      expect(filaArchivada.activo).toBe(false);

      // 200 no-op redundante de archivo
      const resArchivoNoOp = await request(app)
        .post(`/administradores/reportes/${terminalId}/archivo`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({});
      expect(resArchivoNoOp.status).toBe(200);
      expect(resArchivoNoOp.body).toEqual({
        cambiado: false,
        id: terminalId,
        activo: false,
      });

      // 200 reactivación exitosa por admin sobre reporte terminal
      const resReactivacion = await request(app)
        .post(`/administradores/reportes/${terminalId}/reactivacion`)
        .set('Authorization', `Bearer ${fixtures.tokenAdmin}`)
        .send({});
      expect(resReactivacion.status).toBe(200);
      expect(resReactivacion.body).toEqual({
        cambiado: true,
        id: terminalId,
        activo: true,
      });

      const filaReactivada = (await client.query('SELECT estado, activo FROM reportes WHERE id = $1', [terminalId])).rows[0];
      expect(filaReactivada.estado).toBe('devuelto');
      expect(filaReactivada.activo).toBe(true);

      // 200 no-op redundante de reactivación
      const resReactivacionNoOp = await request(app)
        .post(`/administradores/reportes/${terminalId}/reactivacion`)
        .set('Authorization', `Bearer ${fixtures.tokenServicios}`)
        .send({});
      expect(resReactivacionNoOp.status).toBe(200);
      expect(resReactivacionNoOp.body).toEqual({
        cambiado: false,
        id: terminalId,
        activo: true,
      });
    }));
});

