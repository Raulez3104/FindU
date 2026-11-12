import 'dotenv/config';

import { randomInt, randomUUID } from 'crypto';
import type { PoolClient } from 'pg';

import pool = require('../config/database');
import { conTransaccionPrueba } from './helpers/dbTransaccion';
import type {
  OperacionAdministrativa,
  PerfilAdministrador,
  RolAdministrativo,
  TipoReporte,
  EstadoReporte,
} from '../types/modelos';
import * as servicioOperaciones from '../services/servicioOperacionesReportes';

type AccesoTransaccional = Pick<PoolClient, 'query' | 'release'>;

interface FixturePrueba {
  readonly admin: PerfilAdministrador;
  readonly personalServicios: PerfilAdministrador;
  readonly superadmin: PerfilAdministrador;
  readonly usuario: number;
  readonly categoria: number;
  readonly categoriaInactiva: number;
  readonly ubicacion: { id: number; campus: string };
  readonly campus: string;
}

beforeAll(() => {
  process.env.JWT_SECRET = 'secreto-de-prueba-integracion-operaciones';
  process.env.JWT_EXPIRACION_HORAS = '24';
});

afterAll(() => {
  return pool.end();
});

async function prepararFixtures(client: AccesoTransaccional): Promise<FixturePrueba> {
  const marca = `t4-${randomUUID()}`;
  const id = () => randomInt(1000000000, 2000000000);

  const adminId = id();
  await client.query(
    'INSERT INTO administradores (id, nombre, correo, contrasena, rol, activo) VALUES ($1, $2, $3, $4, $5, TRUE)',
    [adminId, `${marca}-admin`, `${marca}.admin@example.invalid`, 'hash', 'admin'],
  );

  const serviciosId = id();
  await client.query(
    'INSERT INTO administradores (id, nombre, correo, contrasena, rol, activo) VALUES ($1, $2, $3, $4, $5, TRUE)',
    [serviciosId, `${marca}-servicios`, `${marca}.servicios@example.invalid`, 'hash', 'personal_servicios'],
  );

  const superadminId = id();
  await client.query(
    'INSERT INTO administradores (id, nombre, correo, contrasena, rol, activo) VALUES ($1, $2, $3, $4, $5, TRUE)',
    [superadminId, `${marca}-super`, `${marca}.super@example.invalid`, 'hash', 'superadmin'],
  );

  const usuarioId = id();
  await client.query(
    'INSERT INTO usuarios (id, nombre, correo) VALUES ($1, $2, $3)',
    [usuarioId, `${marca}-usuario`, `${marca}.user@example.invalid`],
  );

  const categoriaId = id();
  const categoriaInactivaId = id();
  await client.query(
    'INSERT INTO categorias (id, nombre, activo) VALUES ($1, $2, TRUE), ($3, $4, FALSE)',
    [categoriaId, `${marca}-cat`, categoriaInactivaId, `${marca}-cat-inactiva`],
  );

  const ubicacionId = id();
  await client.query(
    'INSERT INTO ubicaciones (id, nombre, campus, activo) VALUES ($1, $2, $3, TRUE)',
    [ubicacionId, `${marca}-ubi`, marca],
  );

  return {
    admin: { id: adminId, nombre: `${marca}-admin`, correo: `${marca}.admin@example.invalid`, rol: 'admin' },
    personalServicios: { id: serviciosId, nombre: `${marca}-servicios`, correo: `${marca}.servicios@example.invalid`, rol: 'personal_servicios' },
    superadmin: { id: superadminId, nombre: `${marca}-super`, correo: `${marca}.super@example.invalid`, rol: 'superadmin' },
    usuario: usuarioId,
    categoria: categoriaId,
    categoriaInactiva: categoriaInactivaId,
    ubicacion: { id: ubicacionId, campus: marca },
    campus: marca,
  };
}

async function crearReportePrueba(
  client: AccesoTransaccional,
  fixtures: FixturePrueba,
  {
    tipo = 'encontrado' as TipoReporte,
    estado = 'encontrado' as EstadoReporte,
    activo = true,
    autorAdmin = false,
  } = {},
): Promise<number> {
  const id = randomInt(1000000000, 2000000000);
  await client.query(
    `INSERT INTO reportes (
       id, usuario_id, administrador_id, titulo, descripcion, contacto, categoria_id,
       fecha_incidente, campus, ubicacion_id, tipo_reporte, estado, activo, imagen
     ) VALUES (
       $1, $2, $3, 'Objeto de prueba', 'Descripción', 'contacto@test', $4,
       '2026-11-01', $5, $6, $7, $8, $9, 'imagen.jpg'
     )`,
    [
      id,
      autorAdmin ? null : fixtures.usuario,
      autorAdmin ? fixtures.admin.id : null,
      fixtures.categoria,
      fixtures.campus,
      fixtures.ubicacion.id,
      tipo,
      estado,
      activo,
    ],
  );
  if (estado !== 'encontrado' && estado !== 'perdido') {
    await client.query('UPDATE reportes SET estado = $1 WHERE id = $2', [estado, id]);
  }
  return id;
}

describe('006A T4: Núcleo transaccional y auditoría con PostgreSQL real', () => {
  test('recepción atómica: actualiza reporte e inserta historial y registro_administradores en un único PoolClient', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);
      const reporteId = await crearReportePrueba(client, fixtures, { tipo: 'encontrado', estado: 'encontrado' });

      const resultado = await servicioOperaciones.ejecutarOperacionReporte({
        id: reporteId,
        operacion: 'recepcion',
        actor: fixtures.personalServicios,
      });

      expect(resultado).toEqual({
        cambiado: true,
        id: reporteId,
        estado: 'En servicios',
      });

      // Verificar persistencia de reporte
      const filaReporte = (await client.query('SELECT estado FROM reportes WHERE id = $1', [reporteId])).rows[0];
      expect(filaReporte.estado).toBe('en_servicios');

      // Verificar persistencia en historial
      const filasHistorial = (await client.query('SELECT accion, valor_anterior, valor_nuevo, realizado_por, tipo_realizado_por FROM historial WHERE reporte_id = $1', [reporteId])).rows;
      expect(filasHistorial).toHaveLength(1);
      expect(filasHistorial[0]).toEqual({
        accion: 'recepcion',
        valor_anterior: 'encontrado',
        valor_nuevo: 'en_servicios',
        realizado_por: fixtures.personalServicios.id,
        tipo_realizado_por: 'admin',
      });

      // Verificar persistencia en registro_administradores
      const filasRegistro = (await client.query('SELECT administrador_id, accion, tabla_destino, id_destino, detalles FROM registro_administradores WHERE id_destino = $1', [reporteId])).rows;
      expect(filasRegistro).toHaveLength(1);
      expect(filasRegistro[0]).toEqual({
        administrador_id: fixtures.personalServicios.id,
        accion: 'recepcion_reporte',
        tabla_destino: 'reportes',
        id_destino: reporteId,
        detalles: null,
      });
    }));

  test('no-op atómico: no escribe en reportes, historial ni registro_administradores', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);
      const reporteId = await crearReportePrueba(client, fixtures, { tipo: 'encontrado', estado: 'en_servicios' });

      const resultado = await servicioOperaciones.ejecutarOperacionReporte({
        id: reporteId,
        operacion: 'recepcion',
        actor: fixtures.admin,
      });

      expect(resultado).toEqual({
        cambiado: false,
        id: reporteId,
        estado: 'En servicios',
      });

      // Verificar que NO se crearon entradas en historial ni registro_administradores
      const hist = (await client.query('SELECT id FROM historial WHERE reporte_id = $1', [reporteId])).rows;
      expect(hist).toHaveLength(0);

      const reg = (await client.query('SELECT id FROM registro_administradores WHERE id_destino = $1', [reporteId])).rows;
      expect(reg).toHaveLength(0);
    }));

  test('devolución atómica con verificación A10: persiste detalles JSONB', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);
      const reporteId = await crearReportePrueba(client, fixtures, { tipo: 'encontrado', estado: 'en_servicios' });

      const payloadA10 = {
        nombre_receptor: 'Receptor Ficticio',
        referencia_comprobante: 'Carnet universitario verificado',
        observacion: 'Entregado conforme',
        usuario_id: fixtures.usuario,
      };

      const resultado = await servicioOperaciones.ejecutarOperacionReporte({
        id: reporteId,
        operacion: 'devolucion',
        actor: fixtures.admin,
        payload: payloadA10,
      });

      expect(resultado).toEqual({
        cambiado: true,
        id: reporteId,
        estado: 'Devuelto',
      });

      const filaReporte = (await client.query('SELECT estado FROM reportes WHERE id = $1', [reporteId])).rows[0];
      expect(filaReporte.estado).toBe('devuelto');

      const filasRegistro = (await client.query('SELECT detalles FROM registro_administradores WHERE id_destino = $1', [reporteId])).rows;
      expect(filasRegistro).toHaveLength(1);
      expect(filasRegistro[0].detalles).toEqual(payloadA10);
    }));

  test('edición atómica con diferencias e historial por campo', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);
      const reporteId = await crearReportePrueba(client, fixtures, { tipo: 'encontrado', estado: 'en_servicios' });

      const resultado = await servicioOperaciones.ejecutarOperacionReporte({
        id: reporteId,
        operacion: 'edicion',
        actor: fixtures.admin,
        payload: { titulo: 'Nuevo título editado' },
      });

      expect(resultado).toEqual({
        actualizado: true,
        id: reporteId,
      });

      const filaReporte = (await client.query('SELECT titulo FROM reportes WHERE id = $1', [reporteId])).rows[0];
      expect(filaReporte.titulo).toBe('Nuevo título editado');

      const filasHist = (await client.query('SELECT accion, valor_anterior, valor_nuevo FROM historial WHERE reporte_id = $1', [reporteId])).rows;
      expect(filasHist).toHaveLength(1);
      expect(filasHist[0].accion).toBe('edicion');
      expect(JSON.parse(filasHist[0].valor_anterior!)).toEqual({ campo: 'titulo', valor: 'Objeto de prueba' });
      expect(JSON.parse(filasHist[0].valor_nuevo!)).toEqual({ campo: 'titulo', valor: 'Nuevo título editado' });
    }));

  test('archivo y reactivación atómicos', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);
      const reporteId = await crearReportePrueba(client, fixtures, { tipo: 'encontrado', estado: 'en_servicios', activo: true });

      // Archivar
      const resArchivo = await servicioOperaciones.ejecutarOperacionReporte({
        id: reporteId,
        operacion: 'archivo',
        actor: fixtures.admin,
      });
      expect(resArchivo).toEqual({ cambiado: true, id: reporteId, activo: false });

      const filaArchivada = (await client.query('SELECT activo FROM reportes WHERE id = $1', [reporteId])).rows[0];
      expect(filaArchivada.activo).toBe(false);

      // Reactivar
      const resReactivacion = await servicioOperaciones.ejecutarOperacionReporte({
        id: reporteId,
        operacion: 'reactivacion',
        actor: fixtures.personalServicios,
      });
      expect(resReactivacion).toEqual({ cambiado: true, id: reporteId, activo: true });

      const filaReactivada = (await client.query('SELECT activo FROM reportes WHERE id = $1', [reporteId])).rows[0];
      expect(filaReactivada.activo).toBe(true);
    }));

  test('rechazo con 409 sobre reporte archivado y rollback sin escrituras', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);
      const reporteId = await crearReportePrueba(client, fixtures, { tipo: 'encontrado', estado: 'en_servicios', activo: false });

      await expect(
        servicioOperaciones.ejecutarOperacionReporte({
          id: reporteId,
          operacion: 'recepcion',
          actor: fixtures.admin,
        }),
      ).rejects.toMatchObject({ status: 409, message: 'No se puede operar sobre un reporte archivado' });

      // Verificar que no se alteró
      const reg = (await client.query('SELECT id FROM registro_administradores WHERE id_destino = $1', [reporteId])).rows;
      expect(reg).toHaveLength(0);
    }));

  test('rechazo con 404 sobre reporte inexistente', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);

      await expect(
        servicioOperaciones.ejecutarOperacionReporte({
          id: 999999999,
          operacion: 'recepcion',
          actor: fixtures.admin,
        }),
      ).rejects.toMatchObject({ status: 404, message: 'Reporte no encontrado' });
    }));

  test('rechazo con 400 ante usuario_id inexistente en devolución', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);
      const reporteId = await crearReportePrueba(client, fixtures, { tipo: 'encontrado', estado: 'en_servicios' });

      await expect(
        servicioOperaciones.ejecutarOperacionReporte({
          id: reporteId,
          operacion: 'devolucion',
          actor: fixtures.admin,
          payload: {
            nombre_receptor: 'Receptor',
            referencia_comprobante: 'Comprobante',
            usuario_id: 999999999,
          },
        }),
      ).rejects.toMatchObject({ status: 400, message: 'El usuario especificado no existe' });
    }));

  test('fallo en inserción de historial revierte UPDATE de reporte y libera la conexión', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);
      const reporteId = await crearReportePrueba(client, fixtures, { tipo: 'encontrado', estado: 'encontrado' });

      // Interceptar pool.connect para provocar fallo en el cliente de la transacción
      const connectOrig = pool.connect;
      const clientTransaccional = await connectOrig();
      const queryOrig = clientTransaccional.query.bind(clientTransaccional);
      let falloProvocado = false;

      clientTransaccional.query = (async (sql: any, params: any) => {
        if (typeof sql === 'string' && /INSERT\s+INTO\s+historial/i.test(sql)) {
          falloProvocado = true;
          throw new Error('Fallo provocado en historial');
        }
        return queryOrig(sql, params);
      }) as PoolClient['query'];

      pool.connect = async () => clientTransaccional;

      try {
        await expect(
          servicioOperaciones.ejecutarOperacionReporte({
            id: reporteId,
            operacion: 'recepcion',
            actor: fixtures.personalServicios,
          }),
        ).rejects.toThrow('Fallo provocado en historial');

        expect(falloProvocado).toBe(true);
      } finally {
        pool.connect = connectOrig;
      }

      // Comprobar rollback en BD usando el cliente de prueba
      const fila = (await client.query('SELECT estado FROM reportes WHERE id = $1', [reporteId])).rows[0];
      expect(fila.estado).toBe('encontrado'); // Se revirtió el UPDATE a en_servicios

      const regs = (await client.query('SELECT id FROM registro_administradores WHERE id_destino = $1', [reporteId])).rows;
      expect(regs).toHaveLength(0);
    }));

  test('T16: fallo en registro_administradores durante devolución revierte reporte e historial completamente', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);
      const reporteId = await crearReportePrueba(client, fixtures, { tipo: 'encontrado', estado: 'en_servicios' });

      const connectOrig = pool.connect;
      const clientTransaccional = await connectOrig();
      const queryOrig = clientTransaccional.query.bind(clientTransaccional);
      let falloProvocado = false;

      clientTransaccional.query = (async (sql: any, params: any) => {
        if (typeof sql === 'string' && /INSERT\s+INTO\s+registro_administradores/i.test(sql)) {
          falloProvocado = true;
          throw new Error('Fallo provocado en registro_administradores');
        }
        return queryOrig(sql, params);
      }) as PoolClient['query'];

      pool.connect = async () => clientTransaccional;

      try {
        await expect(
          servicioOperaciones.ejecutarOperacionReporte({
            id: reporteId,
            operacion: 'devolucion',
            actor: fixtures.admin,
            payload: {
              nombre_receptor: 'Receptor Pruebas',
              referencia_comprobante: 'Acta-999',
            },
          }),
        ).rejects.toThrow('Fallo provocado en registro_administradores');

        expect(falloProvocado).toBe(true);
      } finally {
        pool.connect = connectOrig;
      }

      // Comprobar rollback en BD: estado debe seguir en_servicios, no devuelto
      const fila = (await client.query('SELECT estado FROM reportes WHERE id = $1', [reporteId])).rows[0];
      expect(fila.estado).toBe('en_servicios');

      // No debe existir historial de devolucion ni registro_administradores
      const filasHist = (await client.query('SELECT id FROM historial WHERE reporte_id = $1 AND accion = $2', [reporteId, 'devolucion'])).rows;
      expect(filasHist).toHaveLength(0);

      const filasReg = (await client.query('SELECT id FROM registro_administradores WHERE id_destino = $1', [reporteId])).rows;
      expect(filasReg).toHaveLength(0);
    }));

  test('T16: traza minimizada expone exclusivamente campos A10 sin PII ni credenciales en auditoría', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);
      const reporteId = await crearReportePrueba(client, fixtures, { tipo: 'encontrado', estado: 'en_servicios' });

      await servicioOperaciones.ejecutarOperacionReporte({
        id: reporteId,
        operacion: 'devolucion',
        actor: fixtures.admin,
        payload: {
          nombre_receptor: 'Ana Estudiante',
          referencia_comprobante: 'Comprobante-A10-Valido',
          observacion: 'Entrega conforme en ventanilla',
          usuario_id: fixtures.usuario,
        },
      });

      const traza = await servicioOperaciones.consultarTrazaReporte(reporteId);
      expect(traza.verificacion_devolucion).toEqual({
        nombre_receptor: 'Ana Estudiante',
        referencia_comprobante: 'Comprobante-A10-Valido',
        observacion: 'Entrega conforme en ventanilla',
        usuario_id: fixtures.usuario,
      });

      // Validar que en registro_administradores solo se guardan los campos estrictos
      const reg = (
        await client.query(
          "SELECT detalles FROM registro_administradores WHERE id_destino = $1 AND accion = 'devolucion_reporte'",
          [reporteId],
        )
      ).rows[0];
      expect(reg.detalles).toEqual({
        nombre_receptor: 'Ana Estudiante',
        referencia_comprobante: 'Comprobante-A10-Valido',
        observacion: 'Entrega conforme en ventanilla',
        usuario_id: fixtures.usuario,
      });
      expect(reg.detalles.contrasena).toBeUndefined();
      expect(reg.detalles.token).toBeUndefined();
    }));

  test('T16: auditoría append-only: no-op no genera filas adicionales en historial ni registro_administradores', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);
      const reporteId = await crearReportePrueba(client, fixtures, { tipo: 'encontrado', estado: 'en_servicios' });

      // Primera devolución -> cambia
      const res1 = await servicioOperaciones.ejecutarOperacionReporte({
        id: reporteId,
        operacion: 'devolucion',
        actor: fixtures.admin,
        payload: {
          nombre_receptor: 'Receptor Original',
          referencia_comprobante: 'Comp-Original',
        },
      });
      expect((res1 as any).cambiado).toBe(true);

      const conteoHist1 = (await client.query('SELECT COUNT(*) FROM historial WHERE reporte_id = $1', [reporteId])).rows[0].count;
      const conteoReg1 = (await client.query('SELECT COUNT(*) FROM registro_administradores WHERE id_destino = $1', [reporteId])).rows[0].count;

      // Segunda devolución redundante -> no-op 200 cambiado:false
      const res2 = await servicioOperaciones.ejecutarOperacionReporte({
        id: reporteId,
        operacion: 'devolucion',
        actor: fixtures.personalServicios,
        payload: {
          nombre_receptor: 'Otro Receptor Intento',
          referencia_comprobante: 'Comp-Otro',
        },
      });
      expect((res2 as any).cambiado).toBe(false);

      const conteoHist2 = (await client.query('SELECT COUNT(*) FROM historial WHERE reporte_id = $1', [reporteId])).rows[0].count;
      const conteoReg2 = (await client.query('SELECT COUNT(*) FROM registro_administradores WHERE id_destino = $1', [reporteId])).rows[0].count;

      expect(conteoHist2).toBe(conteoHist1);
      expect(conteoReg2).toBe(conteoReg1);

      // El receptor en traza no cambió
      const traza = await servicioOperaciones.consultarTrazaReporte(reporteId);
      expect(traza.verificacion_devolucion?.nombre_receptor).toBe('Receptor Original');
    }));

  test('V4-T4 / A13: cierre transaccional con enlace 1:1, locks ascendentes y auditoría', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);

      // Crear un encontrado y devolverlo con A10
      const encontradoId = await crearReportePrueba(client, fixtures, { tipo: 'encontrado', estado: 'en_servicios' });
      await servicioOperaciones.ejecutarOperacionReporte({
        id: encontradoId,
        operacion: 'devolucion',
        actor: fixtures.admin,
        payload: {
          nombre_receptor: 'Receptor Original',
          referencia_comprobante: 'Comp-Encontrado',
        },
      });

      // Crear un perdido
      const perdidoId = await crearReportePrueba(client, fixtures, { tipo: 'perdido', estado: 'perdido' });

      // Ejecutar cierre por enlace
      const resCierre = await servicioOperaciones.ejecutarOperacionReporte({
        id: perdidoId,
        operacion: 'cierre',
        actor: fixtures.personalServicios,
        payload: { reporte_encontrado_id: encontradoId },
      });

      expect(resCierre).toEqual({
        cambiado: true,
        id: perdidoId,
        estado: 'Devuelto',
      });

      // Verificar estado en BD
      const filaPerdido = (await client.query('SELECT estado FROM reportes WHERE id = $1', [perdidoId])).rows[0];
      expect(filaPerdido.estado).toBe('devuelto');

      // Verificar que el encontrado no se modificó
      const filaEncontrado = (await client.query('SELECT estado FROM reportes WHERE id = $1', [encontradoId])).rows[0];
      expect(filaEncontrado.estado).toBe('devuelto');

      // Verificar registro_administradores del perdido
      const reg = (
        await client.query(
          "SELECT accion, detalles FROM registro_administradores WHERE id_destino = $1 AND accion = 'cierre_reporte'",
          [perdidoId],
        )
      ).rows[0];
      expect(reg).toBeDefined();
      const det = typeof reg.detalles === 'string' ? JSON.parse(reg.detalles) : reg.detalles;
      expect(det.reporte_encontrado_id).toBe(encontradoId);
      expect(det.registro_devolucion_id).toBeGreaterThan(0);

      // Reintento idéntico sobre el mismo perdido -> 200 sin escritura
      const resNoOp = await servicioOperaciones.ejecutarOperacionReporte({
        id: perdidoId,
        operacion: 'cierre',
        actor: fixtures.admin,
        payload: { reporte_encontrado_id: encontradoId },
      });
      expect(resNoOp).toEqual({
        cambiado: false,
        id: perdidoId,
        estado: 'Devuelto',
      });

      // Intento de reasignar a otra contraparte -> 409
      await expect(
        servicioOperaciones.ejecutarOperacionReporte({
          id: perdidoId,
          operacion: 'cierre',
          actor: fixtures.admin,
          payload: { reporte_encontrado_id: 999999 },
        }),
      ).rejects.toMatchObject({ status: 409, message: 'El reporte ya se encuentra vinculado a otra contraparte' });

      // Intentar usar la misma contraparte para OTRO reporte perdido -> 409 exclusivo 1:1
      const otroPerdidoId = await crearReportePrueba(client, fixtures, { tipo: 'perdido', estado: 'perdido' });
      await expect(
        servicioOperaciones.ejecutarOperacionReporte({
          id: otroPerdidoId,
          operacion: 'cierre',
          actor: fixtures.personalServicios,
          payload: { reporte_encontrado_id: encontradoId },
        }),
      ).rejects.toMatchObject({
        status: 409,
        message: 'La contraparte seleccionada ya fue utilizada para cerrar otro reporte',
      });
    }));

  test('V4-T4 / A15: cierre histórico sin enlace devuelve no-op con nota literal', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);

      // Reporte perdido que ya quedó en estado devuelto sin fila de cierre_reporte
      const perdidoHistoricoId = await crearReportePrueba(client, fixtures, { tipo: 'perdido', estado: 'devuelto' });

      const res = await servicioOperaciones.ejecutarOperacionReporte({
        id: perdidoHistoricoId,
        operacion: 'cierre',
        actor: fixtures.admin,
        payload: { reporte_encontrado_id: 12345 },
      });

      expect(res).toEqual({
        cambiado: false,
        id: perdidoHistoricoId,
        estado: 'Devuelto',
        nota: 'Cierre anterior sin contraparte registrada',
      });
    }));

  test('CORR-R1-H5: candidatos excluyen encontrados cuya entrega no tiene A10 completa', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);
      const perdidoId = await crearReportePrueba(client, fixtures, {
        tipo: 'perdido',
        estado: 'perdido',
      });
      const encontradoId = await crearReportePrueba(client, fixtures, {
        tipo: 'encontrado',
        estado: 'en_servicios',
      });
      await client.query("UPDATE reportes SET estado = 'devuelto' WHERE id = $1", [encontradoId]);

      await client.query(
        `INSERT INTO registro_administradores (
           administrador_id, accion, tabla_destino, id_destino, detalles
         ) VALUES ($1, 'devolucion_reporte', 'reportes', $2, $3::jsonb)`,
        [
          fixtures.admin.id,
          encontradoId,
          JSON.stringify({ nombre_receptor: 'Persona ficticia sin referencia' }),
        ],
      );

      const candidatos = await servicioOperaciones.consultarCandidatosCierre(perdidoId);

      expect(candidatos.map((candidato) => candidato.id)).not.toContain(encontradoId);
    }));

  test('CORR-R1-H5: cierre rechaza contraparte cuya entrega no tiene A10 completa', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);
      const perdidoId = await crearReportePrueba(client, fixtures, {
        tipo: 'perdido',
        estado: 'perdido',
      });
      const encontradoId = await crearReportePrueba(client, fixtures, {
        tipo: 'encontrado',
        estado: 'en_servicios',
      });
      await client.query("UPDATE reportes SET estado = 'devuelto' WHERE id = $1", [encontradoId]);

      await client.query(
        `INSERT INTO registro_administradores (
           administrador_id, accion, tabla_destino, id_destino, detalles
         ) VALUES ($1, 'devolucion_reporte', 'reportes', $2, $3::jsonb)`,
        [
          fixtures.admin.id,
          encontradoId,
          JSON.stringify({ referencia_comprobante: 'Verificación ficticia sin receptor' }),
        ],
      );

      await expect(
        servicioOperaciones.ejecutarOperacionReporte({
          id: perdidoId,
          operacion: 'cierre',
          actor: fixtures.admin,
          payload: { reporte_encontrado_id: encontradoId },
        }),
      ).rejects.toMatchObject({
        status: 400,
        message: 'La contraparte no cuenta con una entrega A10 válida registrada',
      });
    }));

  test('CORR-R1-H5: candidatos y cierre comparten A10 completa y la entrega original estable', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);
      const perdidoId = await crearReportePrueba(client, fixtures, {
        tipo: 'perdido',
        estado: 'perdido',
      });

      const crearEncontradoDevuelto = async (activo = true): Promise<number> => {
        const reporteId = await crearReportePrueba(client, fixtures, {
          tipo: 'encontrado',
          estado: 'en_servicios',
        });
        await client.query("UPDATE reportes SET estado = 'devuelto', activo = $2 WHERE id = $1", [
          reporteId,
          activo,
        ]);
        return reporteId;
      };

      const registrarEntrega = async (reporteId: number, detalles: unknown): Promise<number> => {
        const resultado = await client.query<{ id: number }>(
          `INSERT INTO registro_administradores (
             administrador_id, accion, tabla_destino, id_destino, detalles
           ) VALUES ($1, 'devolucion_reporte', 'reportes', $2, $3::jsonb)
           RETURNING id`,
          [fixtures.admin.id, reporteId, JSON.stringify(detalles)],
        );
        return Number(resultado.rows[0].id);
      };

      const validos = new Map<number, number>();
      const validoSinOpcionales = await crearEncontradoDevuelto();
      validos.set(
        validoSinOpcionales,
        await registrarEntrega(validoSinOpcionales, {
          nombre_receptor: 'Persona ficticia',
          referencia_comprobante: 'Verificación presencial ficticia',
        }),
      );

      const validoArchivado = await crearEncontradoDevuelto(false);
      validos.set(
        validoArchivado,
        await registrarEntrega(validoArchivado, {
          nombre_receptor: '😀'.repeat(255),
          referencia_comprobante: 'R'.repeat(255),
          observacion: 'O'.repeat(1000),
          usuario_id: fixtures.usuario,
        }),
      );

      const invalidoConUsuarioInexistente = await crearEncontradoDevuelto();
      await registrarEntrega(invalidoConUsuarioInexistente, {
        nombre_receptor: 'Persona ficticia',
        referencia_comprobante: 'Verificación ficticia',
        usuario_id: 999999999,
      });

      const detallesInvalidos: readonly unknown[] = [
        null,
        [],
        { referencia_comprobante: 'Falta receptor' },
        { nombre_receptor: 'Falta referencia' },
        { nombre_receptor: null, referencia_comprobante: 'Referencia' },
        { nombre_receptor: 'Nombre', referencia_comprobante: null },
        { nombre_receptor: '   ', referencia_comprobante: 'Referencia' },
        { nombre_receptor: 'Nombre', referencia_comprobante: '   ' },
        { nombre_receptor: 123, referencia_comprobante: 'Referencia' },
        { nombre_receptor: 'Nombre', referencia_comprobante: ['Referencia'] },
        { nombre_receptor: '😀'.repeat(256), referencia_comprobante: 'Referencia' },
        {
          nombre_receptor: 'Nombre',
          referencia_comprobante: 'Referencia',
          observacion: 'O'.repeat(1001),
        },
      ];
      const idsInvalidos: number[] = [invalidoConUsuarioInexistente];
      for (const detalles of detallesInvalidos) {
        const reporteId = await crearEncontradoDevuelto();
        idsInvalidos.push(reporteId);
        await registrarEntrega(reporteId, detalles);
      }

      const originalInvalida = await crearEncontradoDevuelto();
      idsInvalidos.push(originalInvalida);
      await registrarEntrega(originalInvalida, { nombre_receptor: 'Original incompleta' });
      await registrarEntrega(originalInvalida, {
        nombre_receptor: 'Registro posterior válido que no regulariza',
        referencia_comprobante: 'Referencia posterior',
      });

      const originalValida = await crearEncontradoDevuelto();
      const originalValidaId = await registrarEntrega(originalValida, {
        nombre_receptor: 'Entrega original válida',
        referencia_comprobante: 'Referencia original válida',
      });
      await registrarEntrega(originalValida, { referencia_comprobante: 'Registro posterior inválido' });
      validos.set(originalValida, originalValidaId);

      const candidatos = await servicioOperaciones.consultarCandidatosCierre(perdidoId);
      const idsCandidatos = new Set(candidatos.map((candidato) => candidato.id));
      for (const reporteId of validos.keys()) expect(idsCandidatos).toContain(reporteId);
      for (const reporteId of idsInvalidos) expect(idsCandidatos).not.toContain(reporteId);

      const resultadoCierre = await servicioOperaciones.ejecutarOperacionReporte({
        id: perdidoId,
        operacion: 'cierre',
        actor: fixtures.admin,
        payload: { reporte_encontrado_id: originalValida },
      });
      expect(resultadoCierre).toMatchObject({ cambiado: true, estado: 'Devuelto' });
      const cierre = (
        await client.query(
          "SELECT detalles FROM registro_administradores WHERE id_destino = $1 AND accion = 'cierre_reporte'",
          [perdidoId],
        )
      ).rows[0];
      expect(cierre.detalles.registro_devolucion_id).toBe(originalValidaId);

      const otroPerdidoId = await crearReportePrueba(client, fixtures, {
        tipo: 'perdido',
        estado: 'perdido',
      });
      await expect(
        servicioOperaciones.ejecutarOperacionReporte({
          id: otroPerdidoId,
          operacion: 'cierre',
          actor: fixtures.personalServicios,
          payload: { reporte_encontrado_id: validoArchivado },
        }),
      ).resolves.toMatchObject({ cambiado: true, estado: 'Devuelto' });
      expect((await client.query('SELECT activo FROM reportes WHERE id = $1', [validoArchivado])).rows[0].activo)
        .toBe(false);
    }));

  test('V4-T5: traza A13 y A15 proyecta entrega estable del encontrado vinculado o nota literal histórica', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);

      // 1. Encontrado devuelto con A10
      const encontradoId = await crearReportePrueba(client, fixtures, { tipo: 'encontrado', estado: 'en_servicios' });
      await servicioOperaciones.ejecutarOperacionReporte({
        id: encontradoId,
        operacion: 'devolucion',
        actor: fixtures.admin,
        payload: {
          nombre_receptor: 'Receptor Original Encontrado',
          referencia_comprobante: 'Comp-Encontrado-A10',
          observacion: 'En ventanilla principal',
        },
      });

      // 2. Perdido cerrado con enlace A13
      const perdidoId = await crearReportePrueba(client, fixtures, { tipo: 'perdido', estado: 'perdido' });
      await servicioOperaciones.ejecutarOperacionReporte({
        id: perdidoId,
        operacion: 'cierre',
        actor: fixtures.personalServicios,
        payload: { reporte_encontrado_id: encontradoId },
      });

      const trazaPerdidoA13 = await servicioOperaciones.consultarTrazaReporte(perdidoId);
      expect(trazaPerdidoA13.enlace_cierre).toEqual({
        reporte_encontrado_id: encontradoId,
        entrega_original: {
          nombre_receptor: 'Receptor Original Encontrado',
          referencia_comprobante: 'Comp-Encontrado-A10',
          observacion: 'En ventanilla principal',
        },
      });
      expect(trazaPerdidoA13.nota_cierre_historico).toBeNull();
      expect(trazaPerdidoA13.verificacion_devolucion).toBeNull();

      // 3. Perdido devuelto histórico A15 sin enlace
      const perdidoHistoricoId = await crearReportePrueba(client, fixtures, { tipo: 'perdido', estado: 'devuelto' });
      const trazaPerdidoA15 = await servicioOperaciones.consultarTrazaReporte(perdidoHistoricoId);
      expect(trazaPerdidoA15.enlace_cierre).toBeNull();
      expect(trazaPerdidoA15.nota_cierre_historico).toBe('Cierre anterior sin contraparte registrada');
      expect(trazaPerdidoA15.verificacion_devolucion).toBeNull();

      // 4. Traza del encontrado devuelto conserva su verificacion_devolucion sin enlace_cierre
      const trazaEncontrado = await servicioOperaciones.consultarTrazaReporte(encontradoId);
      expect(trazaEncontrado.verificacion_devolucion).toEqual({
        nombre_receptor: 'Receptor Original Encontrado',
        referencia_comprobante: 'Comp-Encontrado-A10',
        observacion: 'En ventanilla principal',
      });
      expect(trazaEncontrado.enlace_cierre).toBeNull();
      expect(trazaEncontrado.nota_cierre_historico).toBeNull();
    }));

  test('V4-T7 / B5: proyección JSONB descarta propiedades extra o no permitidas de detalles', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);

      const encontradoId = await crearReportePrueba(client, fixtures, { tipo: 'encontrado', estado: 'en_servicios' });
      await client.query("UPDATE reportes SET estado = 'devuelto' WHERE id = $1", [encontradoId]);
      // Insertar directamente un registro_administradores con campos JSONB adicionales/no permitidos
      await client.query(`
        INSERT INTO registro_administradores (
          administrador_id, accion, tabla_destino, id_destino, detalles
        ) VALUES (
          $1, 'devolucion_reporte', 'reportes', $2, $3::jsonb
        )
      `, [
        fixtures.admin.id,
        encontradoId,
        JSON.stringify({
          nombre_receptor: 'Receptor Filtrado',
          referencia_comprobante: 'Comp-1234',
          campo_privado_no_permitido: 'secreto',
          ip_origen: '192.168.1.1',
          datos_adicionales: { token: 'xyz' },
        }),
      ]);

      const traza = await servicioOperaciones.consultarTrazaReporte(encontradoId);
      expect(traza.verificacion_devolucion).toEqual({
        nombre_receptor: 'Receptor Filtrado',
        referencia_comprobante: 'Comp-1234',
      });
      // Asegurarse de que no contenga ninguna de las claves no permitidas
      const verificacion = traza.verificacion_devolucion as unknown as Record<string, unknown>;
      expect(verificacion).not.toHaveProperty('campo_privado_no_permitido');
      expect(verificacion).not.toHaveProperty('ip_origen');
      expect(verificacion).not.toHaveProperty('datos_adicionales');
    }));

  test('CORR-R1-H4: la entrega referenciada pertenece al encontrado vinculado y a la acción A10', () =>
    conTransaccionPrueba(async (client) => {
      const fixtures = await prepararFixtures(client);
      const encontradoVinculadoId = await crearReportePrueba(client, fixtures, {
        tipo: 'encontrado',
        estado: 'en_servicios',
      });
      const encontradoAjenoId = await crearReportePrueba(client, fixtures, {
        tipo: 'encontrado',
        estado: 'en_servicios',
      });
      await client.query("UPDATE reportes SET estado = 'devuelto' WHERE id = ANY($1::int[])", [
        [encontradoVinculadoId, encontradoAjenoId],
      ]);

      const insertarRegistro = async (
        accion: string,
        tablaDestino: string,
        reporteId: number,
        detalles: Record<string, unknown>,
      ): Promise<number> => {
        const resultado = await client.query<{ id: number }>(
          `INSERT INTO registro_administradores (
             administrador_id, accion, tabla_destino, id_destino, detalles
           ) VALUES ($1, $2, $3, $4, $5::jsonb)
           RETURNING id`,
          [fixtures.admin.id, accion, tablaDestino, reporteId, JSON.stringify(detalles)],
        );
        return Number(resultado.rows[0].id);
      };

      const entregaValidaId = await insertarRegistro(
        'devolucion_reporte',
        'reportes',
        encontradoVinculadoId,
        {
          nombre_receptor: 'Persona ficticia vinculada',
          referencia_comprobante: 'Verificación presencial ficticia',
          observacion: 'Observación ficticia permitida',
          usuario_id: fixtures.usuario,
          dato_no_permitido: 'No proyectar',
        },
      );
      const entregaAjenaId = await insertarRegistro(
        'devolucion_reporte',
        'reportes',
        encontradoAjenoId,
        {
          nombre_receptor: 'Persona ficticia ajena',
          referencia_comprobante: 'Referencia ficticia ajena',
        },
      );
      const accionEquivocadaId = await insertarRegistro(
        'recepcion_reporte',
        'reportes',
        encontradoVinculadoId,
        {
          nombre_receptor: 'Dato ficticio de otra acción',
          referencia_comprobante: 'Referencia ficticia de otra acción',
        },
      );
      const tablaEquivocadaId = await insertarRegistro(
        'devolucion_reporte',
        'usuarios',
        encontradoVinculadoId,
        {
          nombre_receptor: 'Dato ficticio de otra tabla',
          referencia_comprobante: 'Referencia ficticia de otra tabla',
        },
      );

      const crearCierreReferenciado = async (registroDevolucionId: number): Promise<number> => {
        const perdidoId = await crearReportePrueba(client, fixtures, {
          tipo: 'perdido',
          estado: 'devuelto',
        });
        await insertarRegistro('cierre_reporte', 'reportes', perdidoId, {
          reporte_encontrado_id: encontradoVinculadoId,
          registro_devolucion_id: registroDevolucionId,
        });
        return perdidoId;
      };

      const perdidoConEntregaValida = await crearCierreReferenciado(entregaValidaId);
      const perdidoConEntregaAjena = await crearCierreReferenciado(entregaAjenaId);
      const perdidoConAccionEquivocada = await crearCierreReferenciado(accionEquivocadaId);
      const perdidoConTablaEquivocada = await crearCierreReferenciado(tablaEquivocadaId);
      const perdidoConEntregaInexistente = await crearCierreReferenciado(2147483000);

      const trazaValida = await servicioOperaciones.consultarTrazaReporte(perdidoConEntregaValida);
      expect(trazaValida.enlace_cierre).toEqual({
        reporte_encontrado_id: encontradoVinculadoId,
        entrega_original: {
          nombre_receptor: 'Persona ficticia vinculada',
          referencia_comprobante: 'Verificación presencial ficticia',
          observacion: 'Observación ficticia permitida',
          usuario_id: fixtures.usuario,
        },
      });
      expect(trazaValida.enlace_cierre?.entrega_original).not.toHaveProperty('dato_no_permitido');

      for (const perdidoId of [
        perdidoConEntregaAjena,
        perdidoConAccionEquivocada,
        perdidoConTablaEquivocada,
        perdidoConEntregaInexistente,
      ]) {
        const traza = await servicioOperaciones.consultarTrazaReporte(perdidoId);
        expect(traza.enlace_cierre).toEqual({
          reporte_encontrado_id: encontradoVinculadoId,
          entrega_original: null,
        });
        expect(JSON.stringify(traza)).not.toContain('Persona ficticia ajena');
        expect(JSON.stringify(traza)).not.toContain('Dato ficticio de otra acción');
        expect(JSON.stringify(traza)).not.toContain('Dato ficticio de otra tabla');
      }
    }));
});
