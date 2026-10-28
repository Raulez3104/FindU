require('dotenv').config();
const { randomInt, randomUUID } = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const pool = require('../config/database');
const app = require('../app');
const { conTransaccionPrueba } = require('./helpers/dbTransaccion');
const { cargarConfiguracionJwt } = require('../config/jwt');

const jwtSecretAnterior = process.env.JWT_SECRET;
const jwtExpiracionAnterior = process.env.JWT_EXPIRACION_HORAS;

beforeAll(() => {
  process.env.JWT_SECRET = 'secreto-de-prueba-para-integracion-de-administradores';
  process.env.JWT_EXPIRACION_HORAS = '24';
});

afterAll(() => {
  if (jwtSecretAnterior === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = jwtSecretAnterior;
  if (jwtExpiracionAnterior === undefined) delete process.env.JWT_EXPIRACION_HORAS;
  else process.env.JWT_EXPIRACION_HORAS = jwtExpiracionAnterior;
  return pool.end();
});

const PASSWORD_COMUN = 'ClaveAdminSegura123!';

async function prepararFixtures(client) {
  const marca = `t8-${randomUUID()}`;
  const id = () => randomInt(1000000000, 2000000000);
  const passwordHash = await bcrypt.hash(PASSWORD_COMUN, 10);

  // Fixtures de administradores (los tres roles, inactivo, y rol no permitido)
  const superadminId = id();
  await client.query(
    'INSERT INTO administradores (id, nombre, correo, contrasena, rol, activo) VALUES ($1, $2, $3, $4, $5, TRUE)',
    [superadminId, `${marca}-super`, `${marca}.super@example.invalid`, passwordHash, 'superadmin'],
  );

  const adminId = id();
  await client.query(
    'INSERT INTO administradores (id, nombre, correo, contrasena, rol, activo) VALUES ($1, $2, $3, $4, $5, TRUE)',
    [adminId, `${marca}-admin`, `${marca}.admin@example.invalid`, passwordHash, 'admin'],
  );

  const serviciosId = id();
  await client.query(
    'INSERT INTO administradores (id, nombre, correo, contrasena, rol, activo) VALUES ($1, $2, $3, $4, $5, TRUE)',
    [serviciosId, `${marca}-servicios`, `${marca}.servicios@example.invalid`, passwordHash, 'personal_servicios'],
  );

  const inactivoId = id();
  await client.query(
    'INSERT INTO administradores (id, nombre, correo, contrasena, rol, activo) VALUES ($1, $2, $3, $4, $5, FALSE)',
    [inactivoId, `${marca}-inactivo`, `${marca}.inactivo@example.invalid`, passwordHash, 'admin'],
  );

  // Fixtures de soporte para reportes (usuario estudiante, categoría y ubicación)
  const usuarioEstudianteId = id();
  await client.query(
    'INSERT INTO usuarios (id, nombre, correo) VALUES ($1, $2, $3)',
    [usuarioEstudianteId, `${marca}-estudiante`, `${marca}.estudiante@example.invalid`],
  );

  const categoriaId = id();
  await client.query(
    'INSERT INTO categorias (id, nombre, activo) VALUES ($1, $2, TRUE)',
    [categoriaId, `${marca}-cat`],
  );

  const ubicacionId = id();
  await client.query(
    'INSERT INTO ubicaciones (id, nombre, campus, activo) VALUES ($1, $2, $3, TRUE)',
    [ubicacionId, `${marca}-ubi`, `${marca}-campus`],
  );

  // Reportes efímeros con distintos autores, estados y valores de activo
  // Reporte 1: activo TRUE, autor usuario estudiante, fecha_creacion más antigua
  const reporte1Id = id();
  await client.query(
    `INSERT INTO reportes (
       id, usuario_id, administrador_id, categoria_id, campus, ubicacion_id,
       titulo, descripcion, contacto, tipo_reporte, estado, activo, fecha_incidente, fecha_creacion
     ) VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, '2026-01-01', NOW() - INTERVAL '2 days')`,
    [
      reporte1Id, usuarioEstudianteId, categoriaId, `${marca}-campus`, ubicacionId,
      `${marca}-objeto-perdido`, 'Mochila negra olvidada', '600112233', 'perdido', 'recibido',
    ],
  );

  // Reporte 2: archivado (activo FALSE), autor administrador 'admin', fecha_creacion intermedia
  const reporte2Id = id();
  await client.query(
    `INSERT INTO reportes (
       id, usuario_id, administrador_id, categoria_id, campus, ubicacion_id,
       titulo, descripcion, contacto, tipo_reporte, estado, activo, fecha_incidente, fecha_creacion
     ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE, '2026-01-02', NOW() - INTERVAL '1 day')`,
    [
      reporte2Id, adminId, categoriaId, `${marca}-campus`, ubicacionId,
      `${marca}-objeto-archivado`, 'Cuaderno hallado en biblioteca', 'personal.servicios@example.invalid', 'encontrado', 'en_custodia',
    ],
  );

  // Reporte 3: activo TRUE, autor administrador 'personal_servicios', fecha_creacion más reciente
  const reporte3Id = id();
  await client.query(
    `INSERT INTO reportes (
       id, usuario_id, administrador_id, categoria_id, campus, ubicacion_id,
       titulo, descripcion, contacto, tipo_reporte, estado, activo, fecha_incidente, fecha_creacion
     ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, '2026-01-03', NOW())`,
    [
      reporte3Id, serviciosId, categoriaId, `${marca}-campus`, ubicacionId,
      `${marca}-objeto-en-servicios`, 'Llaves entregadas a servicios', 'servicios@example.invalid', 'encontrado', 'en_servicios',
    ],
  );

  return {
    marca,
    admins: {
      superadmin: { id: superadminId, correo: `${marca}.super@example.invalid`, rol: 'superadmin' },
      admin: { id: adminId, correo: `${marca}.admin@example.invalid`, rol: 'admin' },
      servicios: { id: serviciosId, correo: `${marca}.servicios@example.invalid`, rol: 'personal_servicios' },
      inactivo: { id: inactivoId, correo: `${marca}.inactivo@example.invalid`, rol: 'admin' },
    },
    estudiante: { id: usuarioEstudianteId, correo: `${marca}.estudiante@example.invalid` },
    categoriaId,
    ubicacionId,
    reportes: {
      reporte1: { id: reporte1Id, titulo: `${marca}-objeto-perdido`, activo: true },
      reporte2: { id: reporte2Id, titulo: `${marca}-objeto-archivado`, activo: false },
      reporte3: { id: reporte3Id, titulo: `${marca}-objeto-en-servicios`, activo: true },
    },
  };
}

async function conDatosAdmin(comprobar) {
  let datos;
  const queryOriginal = pool.query;
  const connectOriginal = pool.connect;
  try {
    return await conTransaccionPrueba(async (client) => {
      datos = await prepararFixtures(client);
      await comprobar(datos, client);
    });
  } finally {
    expect(pool.query).toBe(queryOriginal);
    expect(pool.connect).toBe(connectOriginal);
    if (datos) {
      // Verificación de ROLLBACK estricto: ningún ID o marca efímera debe persistir en la BD real
      const adminIds = Object.values(datos.admins).map((a) => a.id);
      const reporteIds = Object.values(datos.reportes).map((r) => r.id);

      const adminsPersistentes = await pool.query(
        'SELECT id FROM administradores WHERE id = ANY($1::int[])',
        [adminIds],
      );
      expect(adminsPersistentes.rows).toEqual([]);

      const reportesPersistentes = await pool.query(
        'SELECT id FROM reportes WHERE id = ANY($1::int[])',
        [reporteIds],
      );
      expect(reportesPersistentes.rows).toEqual([]);

      const usuariosPersistentes = await pool.query(
        'SELECT id FROM usuarios WHERE id = $1',
        [datos.estudiante.id],
      );
      expect(usuariosPersistentes.rows).toEqual([]);

      const categoriasPersistentes = await pool.query(
        'SELECT id FROM categorias WHERE id = $1',
        [datos.categoriaId],
      );
      expect(categoriasPersistentes.rows).toEqual([]);

      const ubicacionesPersistentes = await pool.query(
        'SELECT id FROM ubicaciones WHERE id = $1',
        [datos.ubicacionId],
      );
      expect(ubicacionesPersistentes.rows).toEqual([]);
    }
  }
}

function firmarJwtEstudiante(usuarioId) {
  const config = cargarConfiguracionJwt();
  return jwt.sign(
    { sub: String(usuarioId), ambito: 'estudiante' },
    config.secret,
    { algorithm: 'HS256', expiresIn: '24h', issuer: config.emisor },
  );
}

describe('003A — Integración PostgreSQL real y rollback (T8)', () => {
  describe('Login con bcrypt y base de datos real (POST /administradores/login)', () => {
    it('autentica exitosamente a los tres roles con bcrypt real y emite sesión administrativa canónica', async () => {
      await conDatosAdmin(async (datos) => {
        const config = cargarConfiguracionJwt();
        for (const claveRol of ['superadmin', 'admin', 'servicios']) {
          const cuenta = datos.admins[claveRol];
          const respuesta = await request(app)
            .post('/administradores/login')
            .send({ correo: cuenta.correo, contrasena: PASSWORD_COMUN })
            .expect(200);

          expect(respuesta.body).toHaveProperty('token');
          expect(typeof respuesta.body.token).toBe('string');
          expect(respuesta.body).toHaveProperty('expiraEn');
          expect(typeof respuesta.body.expiraEn).toBe('number');
          expect(respuesta.body.administrador).toEqual({
            id: cuenta.id,
            nombre: expect.any(String),
            correo: cuenta.correo,
            rol: cuenta.rol,
          });

          // Verificar que el token sea un JWT válido decodificable
          const payload = jwt.verify(
            respuesta.body.token,
            config.secret,
            { issuer: config.emisor },
          );
          expect(payload.sub).toBe(String(cuenta.id));
          expect(payload.ambito).toBe('administrador');
          expect(payload.rol).toBe(cuenta.rol);
        }
      });
    });

    it('rechaza login con 400 cuando falta correo o contraseña', async () => {
      await conDatosAdmin(async (datos) => {
        const admin = datos.admins.admin;

        await request(app)
          .post('/administradores/login')
          .send({ correo: '', contrasena: PASSWORD_COMUN })
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toBe('Correo y contraseña son requeridos');
          });

        await request(app)
          .post('/administradores/login')
          .send({ correo: admin.correo, contrasena: '' })
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toBe('Correo y contraseña son requeridos');
          });

        await request(app)
          .post('/administradores/login')
          .send({})
          .expect(400);
      });
    });

    it('rechaza login con 401 uniforme ante contraseña incorrecta', async () => {
      await conDatosAdmin(async (datos) => {
        const respuesta = await request(app)
          .post('/administradores/login')
          .send({ correo: datos.admins.admin.correo, contrasena: 'ContraseñaIncorrecta999' })
          .expect(401);

        expect(respuesta.body.message).toBe('Credenciales administrativas inválidas');
        expect(respuesta.body).not.toHaveProperty('token');
      });
    });

    it('rechaza login con 401 uniforme ante correo inexistente', async () => {
      await conDatosAdmin(async () => {
        const respuesta = await request(app)
          .post('/administradores/login')
          .send({ correo: 'inexistente.total@example.invalid', contrasena: PASSWORD_COMUN })
          .expect(401);

        expect(respuesta.body.message).toBe('Credenciales administrativas inválidas');
      });
    });

    it('rechaza login con 401 uniforme cuando la cuenta está inactiva (activo = false)', async () => {
      await conDatosAdmin(async (datos) => {
        const respuesta = await request(app)
          .post('/administradores/login')
          .send({ correo: datos.admins.inactivo.correo, contrasena: PASSWORD_COMUN })
          .expect(401);

        expect(respuesta.body.message).toBe('Credenciales administrativas inválidas');
      });
    });

    it('la base de datos rechaza roles no permitidos mediante restricción check administradores_rol_check', async () => {
      await conDatosAdmin(async (datos, client) => {
        const idPrueba = randomInt(1000000000, 2000000000);
        await expect(
          client.query(
            'INSERT INTO administradores (id, nombre, correo, contrasena, rol, activo) VALUES ($1, $2, $3, $4, $5, TRUE)',
            [idPrueba, 'invalido', `invalido-${datos.marca}@example.invalid`, 'hash', 'rol_no_permitido'],
          ),
        ).rejects.toThrow(/administradores_rol_check/);
      });
    });
  });

  describe('Revalidación de cuenta en BD para cada petición protegida (GET /administradores/reportes)', () => {
    it('rechaza con 401 si la cuenta es desactivada en BD después de haber emitido el token', async () => {
      await conDatosAdmin(async (datos, client) => {
        // 1. Iniciar sesión legítima
        const loginRes = await request(app)
          .post('/administradores/login')
          .send({ correo: datos.admins.admin.correo, contrasena: PASSWORD_COMUN })
          .expect(200);

        const token = loginRes.body.token;

        // 2. Primera petición protegida pasa
        await request(app)
          .get('/administradores/reportes')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        // 3. Desactivar la cuenta del administrador en BD
        await client.query(
          'UPDATE administradores SET activo = FALSE WHERE id = $1',
          [datos.admins.admin.id],
        );

        // 4. La siguiente petición debe revalidar contra BD y rechazar con 401
        const rechazo = await request(app)
          .get('/administradores/reportes')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);

        expect(rechazo.body.message).toBe('Sesión inválida o expirada');
      });
    });

    it('rechaza con 401 si el administrador no existe en la BD', async () => {
      await conDatosAdmin(async () => {
        const config = cargarConfiguracionJwt();
        const tokenInexistente = jwt.sign(
          { sub: '2147483640', ambito: 'administrador', rol: 'admin' },
          config.secret,
          { algorithm: 'HS256', expiresIn: '24h', issuer: config.emisor },
        );

        const rechazo = await request(app)
          .get('/administradores/reportes')
          .set('Authorization', `Bearer ${tokenInexistente}`)
          .expect(401);

        expect(rechazo.body.message).toBe('Sesión inválida o expirada');
      });
    });

    it('rechaza con 403 cuando el rol revalidado en BD no está autorizado para la operación requerida', async () => {
      await conDatosAdmin(async (datos) => {
        const { autenticarAdministrador } = require('../middleware/authMiddleware');
        const { crearAutorizadorPorRoles } = require('../middleware/roleMiddleware');
        const rutaPrueba = `/administradores/prueba-restringida-${datos.marca}`;
        app.get(rutaPrueba, autenticarAdministrador, crearAutorizadorPorRoles(['superadmin']), (req, res) => {
          res.json({ autorizado: true });
        });

        const loginRes = await request(app)
          .post('/administradores/login')
          .send({ correo: datos.admins.servicios.correo, contrasena: PASSWORD_COMUN })
          .expect(200);

        const tokenServicios = loginRes.body.token;

        // personal_servicios no tiene rol 'superadmin', debe responder 403
        const rechazo = await request(app)
          .get(rutaPrueba)
          .set('Authorization', `Bearer ${tokenServicios}`)
          .expect(403);

        expect(rechazo.body.message).toBe('Operación administrativa no habilitada');

        // Y con la cuenta superadmin real en BD sí autoriza
        const loginSuper = await request(app)
          .post('/administradores/login')
          .send({ correo: datos.admins.superadmin.correo, contrasena: PASSWORD_COMUN })
          .expect(200);

        await request(app)
          .get(rutaPrueba)
          .set('Authorization', `Bearer ${loginSuper.body.token}`)
          .expect(200)
          .expect({ autorizado: true });
      });
    });

    it('rechaza con 401 si no se envía token de autorización', async () => {
      await conDatosAdmin(async () => {
        const respuesta = await request(app)
          .get('/administradores/reportes')
          .expect(401);

        expect(respuesta.body.message).toBe('Autenticación requerida');
      });
    });

    it('rechaza con 403 si se envía un token válido pero con ámbito estudiantil', async () => {
      await conDatosAdmin(async (datos) => {
        const tokenEstudiante = firmarJwtEstudiante(datos.estudiante.id);

        const respuesta = await request(app)
          .get('/administradores/reportes')
          .set('Authorization', `Bearer ${tokenEstudiante}`)
          .expect(403);

        expect(respuesta.body.message).toBe('Operación administrativa no habilitada');
      });
    });
  });

  describe('Listado administrativo con PostgreSQL real (GET /administradores/reportes)', () => {
    it('retorna 200 con listado que incluye reportes activos y archivados, ordenados por fecha_creacion DESC', async () => {
      await conDatosAdmin(async (datos) => {
        const loginRes = await request(app)
          .post('/administradores/login')
          .send({ correo: datos.admins.superadmin.correo, contrasena: PASSWORD_COMUN })
          .expect(200);

        const token = loginRes.body.token;

        const respuesta = await request(app)
          .get('/administradores/reportes')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(Array.isArray(respuesta.body)).toBe(true);

        // Filtrar los reportes de nuestra marca efímera
        const nuestros = respuesta.body.filter((r) =>
          [datos.reportes.reporte1.id, datos.reportes.reporte2.id, datos.reportes.reporte3.id].includes(r.id),
        );

        expect(nuestros).toHaveLength(3);

        // Debe incluir tanto activos como archivados
        const activos = nuestros.filter((r) => r.activo === true);
        const archivados = nuestros.filter((r) => r.activo === false);
        expect(activos).toHaveLength(2);
        expect(archivados).toHaveLength(1);
        expect(archivados[0].id).toBe(datos.reportes.reporte2.id);

        // Verificar el orden descendente de fecha_creacion (reporte3 > reporte2 > reporte1)
        const idsOrdenados = nuestros.map((r) => r.id);
        expect(idsOrdenados).toEqual([
          datos.reportes.reporte3.id,
          datos.reportes.reporte2.id,
          datos.reportes.reporte1.id,
        ]);

        // Verificar proyección de autores: reporte 1 (estudiante) y reporte 3 (admin)
        const rEstudiante = nuestros.find((r) => r.id === datos.reportes.reporte1.id);
        expect(rEstudiante.tipo_autor).toBe('usuario');
        expect(rEstudiante.usuario_id).toBe(datos.estudiante.id);
        expect(rEstudiante.usuario_nombre).toBe(`${datos.marca}-estudiante`);

        const rAdmin = nuestros.find((r) => r.id === datos.reportes.reporte3.id);
        expect(rAdmin.tipo_autor).toBe('admin');
        expect(rAdmin.administrador_id).toBe(datos.admins.servicios.id);
        expect(rAdmin.administrador_nombre).toBe(`${datos.marca}-servicios`);
      });
    });
  });

  describe('Estadísticas administrativas con PostgreSQL real (GET /administradores/reportes/estadisticas)', () => {
    it('retorna 200 con la estructura canónica y conteos que reflejan los datos en BD', async () => {
      await conDatosAdmin(async (datos) => {
        const loginRes = await request(app)
          .post('/administradores/login')
          .send({ correo: datos.admins.admin.correo, contrasena: PASSWORD_COMUN })
          .expect(200);

        const token = loginRes.body.token;

        const respuesta = await request(app)
          .get('/administradores/reportes/estadisticas')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(respuesta.body).toHaveProperty('activos');
        expect(respuesta.body).toHaveProperty('inactivos');
        expect(respuesta.body).toHaveProperty('total');

        expect(typeof respuesta.body.activos).toBe('number');
        expect(typeof respuesta.body.inactivos).toBe('number');
        expect(typeof respuesta.body.total).toBe('number');
        expect(respuesta.body.total).toBe(
          respuesta.body.activos + respuesta.body.inactivos,
        );

        // Los conteos deben ser al menos los 3 efímeros insertados (2 activos, 1 inactivo)
        expect(respuesta.body.activos).toBeGreaterThanOrEqual(2);
        expect(respuesta.body.inactivos).toBeGreaterThanOrEqual(1);

        expect(respuesta.body).toHaveProperty('porEstado');
        expect(typeof respuesta.body.porEstado).toBe('object');
        expect(respuesta.body).toHaveProperty('seriesFechas');
        expect(Array.isArray(respuesta.body.seriesFechas)).toBe(true);
        expect(respuesta.body).toHaveProperty('seriesUbicaciones');
        expect(Array.isArray(respuesta.body.seriesUbicaciones)).toBe(true);
      });
    });
  });

  describe('Detalle de reporte administrativo con PostgreSQL real (GET /administradores/reportes/:id)', () => {
    it('retorna 200 para reporte existente activo y para archivado', async () => {
      await conDatosAdmin(async (datos) => {
        const loginRes = await request(app)
          .post('/administradores/login')
          .send({ correo: datos.admins.servicios.correo, contrasena: PASSWORD_COMUN })
          .expect(200);

        const token = loginRes.body.token;

        // Detalle de reporte activo
        const resActivo = await request(app)
          .get(`/administradores/reportes/${datos.reportes.reporte1.id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(resActivo.body.id).toBe(datos.reportes.reporte1.id);
        expect(resActivo.body.titulo).toBe(`${datos.marca}-objeto-perdido`);
        expect(resActivo.body.activo).toBe(true);

        // Detalle de reporte archivado (activo = false)
        const resArchivado = await request(app)
          .get(`/administradores/reportes/${datos.reportes.reporte2.id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(resArchivado.body.id).toBe(datos.reportes.reporte2.id);
        expect(resArchivado.body.titulo).toBe(`${datos.marca}-objeto-archivado`);
        expect(resArchivado.body.activo).toBe(false);
      });
    });

    it('retorna 404 para ID inexistente o inválido', async () => {
      await conDatosAdmin(async (datos) => {
        const loginRes = await request(app)
          .post('/administradores/login')
          .send({ correo: datos.admins.admin.correo, contrasena: PASSWORD_COMUN })
          .expect(200);

        const token = loginRes.body.token;

        // Inexistente
        const res404 = await request(app)
          .get('/administradores/reportes/2147483640')
          .set('Authorization', `Bearer ${token}`)
          .expect(404);

        expect(res404.body.message).toBe('Reporte no encontrado');

        // Inválido (no numérico)
        await request(app)
          .get('/administradores/reportes/no-es-un-id')
          .set('Authorization', `Bearer ${token}`)
          .expect(404);
      });
    });
  });
});
