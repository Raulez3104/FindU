jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('bcrypt', () => ({ compare: jest.fn() }));

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const app = require('../app');
const adminService = require('../services/adminService');
const {
  ROLES_ADMINISTRATIVOS,
  esRolAdministrativo,
} = require('../config/roles');
const { cargarConfiguracionJwt } = require('../config/jwt');
const {
  emitirSesionAdministrativaJwt,
  emitirSesionJwt,
} = require('../services/authService');
const {
  crearAutenticadorAdministrativo,
} = require('../middleware/authMiddleware');
const { crearAutorizadorPorRoles } = require('../middleware/roleMiddleware');
const reportService = require('../services/reportService');
const errorHandler = require('../middleware/errorHandler');

describe('base de roles administrativos', () => {
  test('expone únicamente los tres roles aprobados en una lista inmutable', () => {
    expect(ROLES_ADMINISTRATIVOS).toEqual([
      'superadmin',
      'admin',
      'personal_servicios',
    ]);
    expect(Object.isFrozen(ROLES_ADMINISTRATIVOS)).toBe(true);
    expect(() => ROLES_ADMINISTRATIVOS.push('estudiante')).toThrow(TypeError);
  });

  test.each(['superadmin', 'admin', 'personal_servicios'])(
    'reconoce el rol permitido %s',
    (rol) => {
      expect(esRolAdministrativo(rol)).toBe(true);
    },
  );

  test.each([
    undefined,
    null,
    '',
    'estudiante',
    'Superadmin',
    'personal-servicios',
  ])('rechaza el rol no permitido %s', (rol) => {
    expect(esRolAdministrativo(rol)).toBe(false);
  });
});

describe('emisión JWT administrativa', () => {
  const administrador = Object.freeze({
    id: 31,
    nombre: 'Administradora de prueba',
    correo: 'administrador@example.test',
    rol: 'personal_servicios',
  });
  const secreto = 'secreto-jwt-administrativo-de-prueba';

  test('usa el emisor y algoritmo existentes con ámbito y rol derivados', () => {
    const ahora = Date.UTC(2026, 9, 23, 10, 30, 0);
    const configuracion = cargarConfiguracionJwt({ JWT_SECRET: secreto });

    const sesion = emitirSesionAdministrativaJwt(administrador, {
      configuracion,
      reloj: () => ahora,
    });
    const completo = jwt.decode(sesion.token, { complete: true });
    const payload = jwt.verify(sesion.token, secreto, {
      algorithms: ['HS256'],
      issuer: 'FindU',
      clockTimestamp: Math.floor(ahora / 1000),
    });

    expect(completo.header.alg).toBe('HS256');
    expect(payload).toEqual({
      sub: '31',
      ambito: 'administrador',
      rol: 'personal_servicios',
      iat: Math.floor(ahora / 1000),
      exp: Math.floor(ahora / 1000) + 24 * 60 * 60,
      iss: 'FindU',
    });
    expect(sesion).toEqual({
      token: expect.any(String),
      expiraEn: ahora + 24 * 60 * 60 * 1000,
    });
    expect(sesion).not.toHaveProperty('refreshToken');
  });

  test('respeta una duración configurada sin usar el reloj real', () => {
    const ahora = Date.UTC(2026, 9, 23, 12, 0, 0);
    const configuracion = cargarConfiguracionJwt({
      JWT_SECRET: secreto,
      JWT_EXPIRACION_HORAS: ' 6 ',
    });

    const sesion = emitirSesionAdministrativaJwt(administrador, {
      configuracion,
      reloj: () => ahora,
    });
    const payload = jwt.verify(sesion.token, secreto, {
      algorithms: ['HS256'],
      issuer: 'FindU',
      clockTimestamp: Math.floor(ahora / 1000),
    });

    expect(payload.exp - payload.iat).toBe(6 * 60 * 60);
    expect(sesion.expiraEn).toBe(ahora + 6 * 60 * 60 * 1000);
  });

  test('conserva el ámbito estudiantil sin incorporar rol', () => {
    const ahora = Date.UTC(2026, 9, 23, 13, 0, 0);
    const configuracion = cargarConfiguracionJwt({ JWT_SECRET: secreto });

    const sesion = emitirSesionJwt(
      {
        id: 42,
        nombre: 'Estudiante de prueba',
        correo: 'estudiante@example.test',
        foto: null,
      },
      { configuracion, reloj: () => ahora },
    );
    const payload = jwt.verify(sesion.token, secreto, {
      algorithms: ['HS256'],
      issuer: 'FindU',
      clockTimestamp: Math.floor(ahora / 1000),
    });

    expect(payload.ambito).toBe('estudiante');
    expect(payload).not.toHaveProperty('rol');
    expect(payload.exp - payload.iat).toBe(24 * 60 * 60);
  });
});

describe('contrato del servicio de login administrativo', () => {
  const configuracion = Object.freeze({
    secret: 'secreto-login-administrativo-de-prueba',
    expiracionHoras: 24,
    emisor: 'FindU',
  });
  const ahora = Date.UTC(2026, 9, 23, 15, 0, 0);

  function crearServicio({ filas = [], contrasenaValida = true } = {}) {
    const cliente = {
      query: jest.fn().mockResolvedValue({ rows: filas }),
    };
    const compararContrasena = jest.fn().mockResolvedValue(contrasenaValida);
    const servicio = adminService.crearServicioAdministradores({
      pool: cliente,
      compararContrasena,
      obtenerConfiguracionJwt: () => configuracion,
      reloj: () => ahora,
    });

    return { cliente, compararContrasena, servicio };
  }

  test.each([
    [undefined, 'clave-segura'],
    [null, 'clave-segura'],
    ['', 'clave-segura'],
    ['   ', 'clave-segura'],
    ['admin@example.test', undefined],
    ['admin@example.test', null],
    ['admin@example.test', ''],
    ['admin@example.test', '   '],
  ])(
    'rechaza correo/contrasena ausente o vacío con 400 antes de consultar (%p, %p)',
    async (correo, contrasena) => {
      const { cliente, compararContrasena, servicio } = crearServicio();

      await expect(servicio.login(correo, contrasena)).rejects.toMatchObject({
        status: 400,
      });
      expect(cliente.query).not.toHaveBeenCalled();
      expect(compararContrasena).not.toHaveBeenCalled();
    },
  );

  test.each([
    ['correo inexistente', [], true],
    [
      'contraseña incorrecta',
      [
        {
          id: 1,
          nombre: 'Administración',
          correo: 'admin@example.test',
          contrasena: 'hash-no-publicable',
          rol: 'admin',
          activo: true,
        },
      ],
      false,
    ],
    [
      'cuenta inactiva',
      [
        {
          id: 2,
          nombre: 'Administración',
          correo: 'admin@example.test',
          contrasena: 'hash-no-publicable',
          rol: 'admin',
          activo: false,
        },
      ],
      true,
    ],
    [
      'rol inválido',
      [
        {
          id: 3,
          nombre: 'Administración',
          correo: 'admin@example.test',
          contrasena: 'hash-no-publicable',
          rol: 'estudiante',
          activo: true,
        },
      ],
      true,
    ],
  ])(
    'converge %s en el mismo 401 sin token ni datos filtrados',
    async (_caso, filas, contrasenaValida) => {
      const { servicio } = crearServicio({ filas, contrasenaValida });
      let error;

      try {
        await servicio.login(' admin@example.test ', 'clave-segura');
      } catch (errorRecibido) {
        error = errorRecibido;
      }

      expect(error).toEqual(
        expect.objectContaining({
          status: 401,
          message: 'Credenciales administrativas inválidas',
        }),
      );
      expect(error).not.toHaveProperty('token');
      expect(error).not.toHaveProperty('administrador');
      expect(JSON.stringify(error)).not.toContain('hash-no-publicable');
      expect(JSON.stringify(error)).not.toContain(_caso);
    },
  );

  test.each(['superadmin', 'admin', 'personal_servicios'])(
    'devuelve la sesión y el perfil español exactos para %s',
    async (rol) => {
      const fila = {
        id: 7,
        nombre: 'Administración de prueba',
        correo: 'admin@example.test',
        contrasena: 'hash-no-publicable',
        rol,
        activo: true,
      };
      const { cliente, compararContrasena, servicio } = crearServicio({
        filas: [fila],
      });

      const resultado = await servicio.login(
        ' admin@example.test ',
        'clave-segura',
      );

      expect(cliente.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM administradores'),
        ['admin@example.test'],
      );
      expect(compararContrasena).toHaveBeenCalledWith(
        'clave-segura',
        'hash-no-publicable',
      );
      expect(resultado).toEqual({
        token: expect.any(String),
        expiraEn: ahora + 24 * 60 * 60 * 1000,
        administrador: {
          id: 7,
          nombre: 'Administración de prueba',
          correo: 'admin@example.test',
          rol,
        },
      });
      expect(resultado).not.toHaveProperty('refreshToken');
      expect(resultado.administrador).not.toHaveProperty('contrasena');
      expect(resultado.administrador).not.toHaveProperty('password');
      expect(resultado.administrador).not.toHaveProperty('name');
      expect(resultado.administrador).not.toHaveProperty('email');
      expect(resultado.administrador).not.toHaveProperty('role');
    },
  );
});

describe('POST /administradores/login', () => {
  beforeEach(() => {
    pool.query.mockReset();
    bcrypt.compare.mockReset();
  });

  test('no acepta aliases ingleses y responde 400 sin consultar', async () => {
    const respuesta = await request(app)
      .post('/administradores/login')
      .send({ email: 'admin@example.test', password: 'clave-segura' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toEqual({
      message: 'Correo y contraseña son requeridos',
    });
    expect(pool.query).not.toHaveBeenCalled();
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  test.each([
    ['correo inexistente', [], true],
    [
      'contraseña incorrecta',
      [
        {
          id: 1,
          nombre: 'Administración',
          correo: 'admin@example.test',
          contrasena: 'hash-no-publicable',
          rol: 'admin',
          activo: true,
        },
      ],
      false,
    ],
    [
      'cuenta inactiva',
      [
        {
          id: 2,
          nombre: 'Administración',
          correo: 'admin@example.test',
          contrasena: 'hash-no-publicable',
          rol: 'admin',
          activo: false,
        },
      ],
      true,
    ],
    [
      'rol inválido',
      [
        {
          id: 3,
          nombre: 'Administración',
          correo: 'admin@example.test',
          contrasena: 'hash-no-publicable',
          rol: null,
          activo: true,
        },
      ],
      true,
    ],
  ])('responde el mismo 401 HTTP para %s', async (_caso, filas, coincide) => {
    pool.query.mockResolvedValue({ rows: filas });
    bcrypt.compare.mockResolvedValue(coincide);

    const respuesta = await request(app)
      .post('/administradores/login')
      .send({ correo: 'admin@example.test', contrasena: 'clave-segura' });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual({
      message: 'Credenciales administrativas inválidas',
    });
    expect(respuesta.body).not.toHaveProperty('token');
    expect(respuesta.body).not.toHaveProperty('administrador');
    expect(JSON.stringify(respuesta.body)).not.toContain('hash-no-publicable');
  });

  test.each(['superadmin', 'admin', 'personal_servicios'])(
    'responde 200 con sesión y perfil canónico para %s',
    async (rol) => {
      pool.query.mockResolvedValue({
        rows: [
          {
            id: 9,
            nombre: 'Administración HTTP',
            correo: 'admin@example.test',
            contrasena: 'hash-no-publicable',
            rol,
            activo: true,
          },
        ],
      });
      bcrypt.compare.mockResolvedValue(true);
      const secretoAnterior = process.env.JWT_SECRET;
      process.env.JWT_SECRET = 'secreto-login-http-de-prueba';

      try {
        const respuesta = await request(app)
          .post('/administradores/login')
          .send({ correo: 'admin@example.test', contrasena: 'clave-segura' });

        expect(respuesta.status).toBe(200);
        expect(respuesta.body).toEqual({
          token: expect.any(String),
          expiraEn: expect.any(Number),
          administrador: {
            id: 9,
            nombre: 'Administración HTTP',
            correo: 'admin@example.test',
            rol,
          },
        });
        expect(respuesta.body).not.toHaveProperty('message');
        expect(respuesta.body).not.toHaveProperty('admin');
        expect(JSON.stringify(respuesta.body)).not.toContain(
          'hash-no-publicable',
        );
      } finally {
        if (secretoAnterior === undefined) {
          delete process.env.JWT_SECRET;
        } else {
          process.env.JWT_SECRET = secretoAnterior;
        }
      }
    },
  );
});

describe('autenticación administrativa por solicitud', () => {
  const secreto = 'secreto-middleware-administrativo-de-prueba';
  const configuracionJwt = Object.freeze({
    secret: secreto,
    expiracionHoras: 24,
    emisor: 'FindU',
  });

  function firmarToken(payload = {}, opciones = {}) {
    return jwt.sign(
      { sub: '31', ambito: 'administrador', rol: 'rol-del-claim', ...payload },
      opciones.secret || secreto,
      {
        algorithm: opciones.algorithm || 'HS256',
        issuer: opciones.issuer || 'FindU',
        expiresIn: opciones.expiresIn || '1h',
      },
    );
  }

  function crearAppMiddleware({
    obtenerAdministradorPorId = jest.fn().mockResolvedValue({
      id: 31,
      nombre: 'Administración vigente',
      correo: 'vigente@example.test',
      rol: 'personal_servicios',
      activo: true,
      contrasena: 'no-debe-exponerse',
    }),
    verificarJwt = jwt.verify,
  } = {}) {
    const appMiddleware = express();
    const funcionPosterior = jest.fn((req, res) => {
      res.json({ administrador: req.administrador });
    });
    const middleware = crearAutenticadorAdministrativo({
      obtenerConfiguracionJwt: () => configuracionJwt,
      obtenerAdministradorPorId,
      verificarJwt,
    });
    appMiddleware.get('/administrativa', middleware, funcionPosterior);
    appMiddleware.use(errorHandler);

    return {
      appMiddleware,
      funcionPosterior,
      obtenerAdministradorPorId,
    };
  }

  test.each([
    ['sin cabecera', undefined],
    ['esquema Basic', 'Basic credenciales'],
    ['esquema bearer no canónico', 'bearer token'],
    ['Bearer sin token', 'Bearer'],
    ['token vacío', 'Bearer   '],
    ['dos tokens', 'Bearer token otro'],
    ['valores ambiguos', 'Bearer token, Bearer otro'],
  ])(
    'responde 401 con %s sin consultar cuenta ni continuar',
    async (_caso, authorization) => {
      const contexto = crearAppMiddleware();
      const solicitud = request(contexto.appMiddleware).get('/administrativa');
      if (authorization !== undefined) {
        solicitud.set('Authorization', authorization);
      }

      const respuesta = await solicitud;

      expect(respuesta.status).toBe(401);
      expect(respuesta.body).toEqual({ message: 'Autenticación requerida' });
      expect(contexto.obtenerAdministradorPorId).not.toHaveBeenCalled();
      expect(contexto.funcionPosterior).not.toHaveBeenCalled();
    },
  );

  test.each([
    ['firma inválida', () => firmarToken({}, { secret: 'otro-secreto' })],
    ['algoritmo distinto', () => firmarToken({}, { algorithm: 'HS384' })],
    ['emisor distinto', () => firmarToken({}, { issuer: 'OtroSistema' })],
    ['token vencido', () => firmarToken({}, { expiresIn: -1 })],
    ['token malformado', () => 'no-es-un-jwt'],
  ])(
    'responde 401 ante %s sin consultar cuenta ni continuar',
    async (_caso, crearToken) => {
      const contexto = crearAppMiddleware();

      const respuesta = await request(contexto.appMiddleware)
        .get('/administrativa')
        .set('Authorization', `Bearer ${crearToken()}`);

      expect(respuesta.status).toBe(401);
      expect(respuesta.body).toEqual({ message: 'Sesión inválida o expirada' });
      expect(contexto.obtenerAdministradorPorId).not.toHaveBeenCalled();
      expect(contexto.funcionPosterior).not.toHaveBeenCalled();
    },
  );

  test('verifica Bearer con secreto, HS256 y emisor configurados', async () => {
    const verificarJwt = jest.fn().mockReturnValue({
      sub: '31',
      ambito: 'administrador',
      rol: 'claim-no-confiable',
    });
    const contexto = crearAppMiddleware({ verificarJwt });

    const respuesta = await request(contexto.appMiddleware)
      .get('/administrativa')
      .set('Authorization', 'Bearer jwt-de-prueba');

    expect(respuesta.status).toBe(200);
    expect(verificarJwt).toHaveBeenCalledWith('jwt-de-prueba', secreto, {
      algorithms: ['HS256'],
      issuer: 'FindU',
    });
  });

  test.each([
    ['sub ausente', { sub: undefined, ambito: 'administrador' }],
    ['sub cero', { sub: '0', ambito: 'administrador' }],
    ['sub negativo', { sub: '-1', ambito: 'administrador' }],
    ['sub decimal', { sub: '1.5', ambito: 'administrador' }],
    ['sub ambiguo', { sub: '031', ambito: 'administrador' }],
    ['sub fuera de INTEGER', { sub: '2147483648', ambito: 'administrador' }],
    ['ámbito ausente', { sub: '31', ambito: undefined }],
    ['ámbito desconocido', { sub: '31', ambito: 'otro' }],
  ])('responde 401 ante %s sin consultar ni continuar', async (_caso, payload) => {
    const contexto = crearAppMiddleware({
      verificarJwt: jest.fn().mockReturnValue(payload),
    });

    const respuesta = await request(contexto.appMiddleware)
      .get('/administrativa')
      .set('Authorization', 'Bearer jwt-de-prueba');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual({ message: 'Sesión inválida o expirada' });
    expect(contexto.obtenerAdministradorPorId).not.toHaveBeenCalled();
    expect(contexto.funcionPosterior).not.toHaveBeenCalled();
  });

  test('responde 403 a un JWT estudiantil sin consultar cuenta ni continuar', async () => {
    const contexto = crearAppMiddleware({
      verificarJwt: jest.fn().mockReturnValue({
        sub: '42',
        ambito: 'estudiante',
      }),
    });

    const respuesta = await request(contexto.appMiddleware)
      .get('/administrativa')
      .set('Authorization', 'Bearer jwt-estudiantil-de-prueba');

    expect(respuesta.status).toBe(403);
    expect(respuesta.body).toEqual({
      message: 'Operación administrativa no habilitada',
    });
    expect(contexto.obtenerAdministradorPorId).not.toHaveBeenCalled();
    expect(contexto.funcionPosterior).not.toHaveBeenCalled();
  });

  test.each([
    ['cuenta inexistente', null],
    ['cuenta inactiva', { id: 31, activo: false }],
    ['actividad no booleana', { id: 31, activo: 1 }],
  ])('responde 401 ante %s sin continuar', async (_caso, administrador) => {
    const obtenerAdministradorPorId = jest
      .fn()
      .mockResolvedValue(administrador);
    const contexto = crearAppMiddleware({ obtenerAdministradorPorId });

    const respuesta = await request(contexto.appMiddleware)
      .get('/administrativa')
      .set('Authorization', `Bearer ${firmarToken()}`);

    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual({ message: 'Sesión inválida o expirada' });
    expect(obtenerAdministradorPorId).toHaveBeenCalledWith(31);
    expect(contexto.funcionPosterior).not.toHaveBeenCalled();
  });

  test('revalida y adjunta solo el perfil actual derivado del backend', async () => {
    const contexto = crearAppMiddleware();

    const respuesta = await request(contexto.appMiddleware)
      .get('/administrativa')
      .set('Authorization', `Bearer ${firmarToken()}`);

    expect(respuesta.status).toBe(200);
    expect(contexto.obtenerAdministradorPorId).toHaveBeenCalledWith(31);
    expect(contexto.funcionPosterior).toHaveBeenCalledTimes(1);
    expect(respuesta.body).toEqual({
      administrador: {
        id: 31,
        nombre: 'Administración vigente',
        correo: 'vigente@example.test',
        rol: 'personal_servicios',
      },
    });
    expect(respuesta.body.administrador.rol).not.toBe('rol-del-claim');
    expect(respuesta.body.administrador).not.toHaveProperty('activo');
    expect(respuesta.body.administrador).not.toHaveProperty('contrasena');
  });

  test('propaga fallos de revalidación sin convertirlos en 401 ni continuar', async () => {
    const errorBd = new Error('fallo de revalidación de prueba');
    const contexto = crearAppMiddleware({
      obtenerAdministradorPorId: jest.fn().mockRejectedValue(errorBd),
    });

    const respuesta = await request(contexto.appMiddleware)
      .get('/administrativa')
      .set('Authorization', `Bearer ${firmarToken()}`);

    expect(respuesta.status).toBe(500);
    expect(respuesta.body).toEqual({ message: 'fallo de revalidación de prueba' });
    expect(contexto.funcionPosterior).not.toHaveBeenCalled();
  });
});

describe('RBAC administrativo de solo lectura', () => {
  function crearAppRbac({
    administrador,
    body,
    claims,
    rolesPermitidos = ROLES_ADMINISTRATIVOS,
  } = {}) {
    const appRbac = express();
    const orden = [];
    const autenticarDerivado = (req, _res, next) => {
      orden.push('autenticacion');
      req.administrador = administrador;
      req.claims = claims;
      next();
    };
    const autorizarRol = crearAutorizadorPorRoles(rolesPermitidos);
    const controlador = jest.fn((_req, res) => {
      orden.push('controlador');
      res.json({ ok: true });
    });

    appRbac.use(express.json());
    appRbac.get(
      '/lectura-administrativa',
      autenticarDerivado,
      (req, res, next) => {
        orden.push('rol');
        return autorizarRol(req, res, next);
      },
      controlador,
    );

    return {
      appRbac,
      body,
      controlador,
      orden,
    };
  }

  test.each(ROLES_ADMINISTRATIVOS)(
    'permite la lectura al rol actual derivado %s',
    async (rol) => {
      const contexto = crearAppRbac({
        administrador: { id: 31, rol },
      });

      const respuesta = await request(contexto.appRbac)
        .get('/lectura-administrativa')
        .send(contexto.body);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toEqual({ ok: true });
      expect(contexto.controlador).toHaveBeenCalledTimes(1);
      expect(contexto.orden).toEqual([
        'autenticacion',
        'rol',
        'controlador',
      ]);
    },
  );

  test.each([
    ['identidad ausente', undefined],
    ['rol ausente', { id: 31 }],
    ['rol nulo', { id: 31, rol: null }],
    ['rol desconocido', { id: 31, rol: 'estudiante' }],
  ])('responde 403 ante %s sin alcanzar el controlador', async (_caso, administrador) => {
    const contexto = crearAppRbac({ administrador });

    const respuesta = await request(contexto.appRbac).get(
      '/lectura-administrativa',
    );

    expect(respuesta.status).toBe(403);
    expect(respuesta.body).toEqual({
      message: 'Operación administrativa no habilitada',
    });
    expect(contexto.controlador).not.toHaveBeenCalled();
    expect(contexto.orden).toEqual(['autenticacion', 'rol']);
  });

  test('no confía en roles aportados por cuerpo o claims', async () => {
    const contexto = crearAppRbac({
      administrador: { id: 31, rol: 'rol-desconocido' },
      body: { rol: 'superadmin' },
      claims: { rol: 'admin' },
    });

    const respuesta = await request(contexto.appRbac)
      .get('/lectura-administrativa')
      .send(contexto.body);

    expect(respuesta.status).toBe(403);
    expect(contexto.controlador).not.toHaveBeenCalled();
    expect(contexto.orden).toEqual(['autenticacion', 'rol']);
  });

  test('rechaza un rol actual que no pertenece a la lista específica de la ruta', async () => {
    const contexto = crearAppRbac({
      administrador: { id: 31, rol: 'admin' },
      rolesPermitidos: ['personal_servicios'],
    });

    const respuesta = await request(contexto.appRbac).get(
      '/lectura-administrativa',
    );

    expect(respuesta.status).toBe(403);
    expect(contexto.controlador).not.toHaveBeenCalled();
  });
});

describe('lecturas administrativas del servicio de reportes', () => {
  const camposReporte = [
    'id',
    'usuario_id',
    'administrador_id',
    'tipo_autor',
    'usuario_nombre',
    'usuario_correo',
    'administrador_nombre',
    'titulo',
    'descripcion',
    'contacto',
    'categoria_id',
    'categoria_nombre',
    'fecha_incidente',
    'fecha',
    'campus',
    'ubicacion_id',
    'ubicacion_nombre',
    'ubicacion_otro',
    'imagen',
    'tipo_reporte',
    'estado',
    'activo',
  ];

  const reporteUsuarioActivo = {
    id: 20,
    usuario_id: 4,
    administrador_id: null,
    tipo_autor: 'usuario',
    usuario_nombre: 'Estudiante de prueba',
    usuario_correo: 'estudiante@example.test',
    administrador_nombre: null,
    titulo: 'Mochila',
    descripcion: 'Mochila negra',
    contacto: 'Contacto de prueba',
    categoria_id: 2,
    categoria_nombre: 'Accesorios',
    fecha_incidente: '2026-10-22',
    fecha: '2026-10-23 12:00',
    campus: 'principal',
    ubicacion_id: 8,
    ubicacion_nombre: 'Biblioteca',
    ubicacion_otro: null,
    imagen: 'mochila.jpg',
    tipo_reporte: 'perdido',
    estado: 'perdido',
    activo: true,
  };

  const reporteAdministradorArchivado = {
    id: 19,
    usuario_id: null,
    administrador_id: 3,
    tipo_autor: 'admin',
    usuario_nombre: null,
    usuario_correo: null,
    administrador_nombre: 'Personal de prueba',
    titulo: 'Termo',
    descripcion: 'Termo encontrado',
    contacto: 'Servicios Estudiantiles',
    categoria_id: 5,
    categoria_nombre: 'Otros',
    fecha_incidente: '2026-10-21',
    fecha: '2026-10-22 09:30',
    campus: 'principal',
    ubicacion_id: null,
    ubicacion_nombre: null,
    ubicacion_otro: 'Pasillo B',
    imagen: null,
    tipo_reporte: 'encontrado',
    estado: 'en_servicios',
    activo: false,
  };

  beforeEach(() => {
    pool.query.mockReset();
  });

  test('lista la proyección española completa con autores, ubicaciones y archivados en orden descendente', async () => {
    pool.query.mockResolvedValue({
      rows: [reporteUsuarioActivo, reporteAdministradorArchivado],
    });

    const reportes = await reportService.obtenerReportesAdministrativos();

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [consulta, valores] = pool.query.mock.calls[0];
    expect(consulta).toContain('CASE WHEN r.administrador_id IS NOT NULL');
    expect(consulta).toContain('LEFT JOIN usuarios');
    expect(consulta).toContain('LEFT JOIN administradores');
    expect(consulta).toContain('LEFT JOIN categorias');
    expect(consulta).toContain('LEFT JOIN ubicaciones');
    expect(consulta).toContain('ORDER BY r.fecha_creacion DESC');
    expect(consulta).not.toContain('WHERE r.activo = TRUE');
    expect(valores).toEqual([]);
    expect(reportes.map((reporte) => reporte.id)).toEqual([20, 19]);
    expect(reportes[0]).toEqual({
      ...reporteUsuarioActivo,
      estado: 'Perdido',
    });
    expect(reportes[1]).toEqual({
      ...reporteAdministradorArchivado,
      estado: 'En servicios',
    });
    expect(reportes[1].activo).toBe(false);
    expect(Object.keys(reportes[0])).toEqual(camposReporte);
    expect(Object.keys(reportes[1])).toEqual(camposReporte);
    expect(reportes[0]).not.toHaveProperty('title');
    expect(reportes[0]).not.toHaveProperty('status');
    expect(reportes[0]).not.toHaveProperty('name');
    expect(reportes[0]).not.toHaveProperty('email');
    expect(reportes[0]).not.toHaveProperty('role');
  });

  test('devuelve un arreglo vacío cuando no hay reportes administrativos', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await expect(
      reportService.obtenerReportesAdministrativos(),
    ).resolves.toEqual([]);
  });

  test('reutiliza las estadísticas vigentes con cinco estados y series', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          { estado: 'perdido', count: '2' },
          { estado: 'en_servicios', count: '1' },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ total: '3', activos: '2', inactivos: '1' }],
      })
      .mockResolvedValueOnce({
        rows: [{ fecha: '2026-10-23', count: '3' }],
      })
      .mockResolvedValueOnce({
        rows: [{ campus: 'principal', ubicacion: 'Biblioteca', count: '2' }],
      });

    await expect(reportService.obtenerEstadisticas()).resolves.toEqual({
      total: 3,
      activos: 2,
      inactivos: 1,
      porEstado: {
        Perdido: 2,
        Encontrado: 0,
        'En servicios': 1,
        Devuelto: 0,
        Donado: 0,
      },
      seriesFechas: [{ fecha: '2026-10-23', count: 3 }],
      seriesUbicaciones: [
        { campus: 'principal', ubicacion: 'Biblioteca', count: 2 },
      ],
    });
    expect(pool.query).toHaveBeenCalledTimes(4);
  });

  test('mantiene la forma vacía de las estadísticas administrativas', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ total: '0', activos: '0', inactivos: '0' }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(reportService.obtenerEstadisticas()).resolves.toEqual({
      total: 0,
      activos: 0,
      inactivos: 0,
      porEstado: {
        Perdido: 0,
        Encontrado: 0,
        'En servicios': 0,
        Devuelto: 0,
        Donado: 0,
      },
      seriesFechas: [],
      seriesUbicaciones: [],
    });
  });

  test('reutiliza validación y proyección en el detalle existente', async () => {
    pool.query.mockResolvedValue({ rows: [reporteAdministradorArchivado] });

    await expect(reportService.obtenerPorId('19')).resolves.toEqual({
      ...reporteAdministradorArchivado,
      estado: 'En servicios',
    });
    const [consulta, valores] = pool.query.mock.calls[0];
    expect(consulta).toContain('WHERE r.id = $1');
    expect(consulta).toContain('LEFT JOIN administradores');
    expect(valores).toEqual(['19']);
  });

  test.each([undefined, null, '', 'abc', '0', '-1', '1.5', Number.MAX_SAFE_INTEGER + 1])(
    'rechaza el ID inválido %p sin consultar',
    async (id) => {
      await expect(reportService.obtenerPorId(id)).resolves.toBeUndefined();
      expect(pool.query).not.toHaveBeenCalled();
    },
  );

  test('devuelve undefined para un ID válido inexistente', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await expect(reportService.obtenerPorId('999')).resolves.toBeUndefined();
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});

describe('GET /administradores/reportes protegido', () => {
  const secreto = 'secreto-rutas-administrativas-de-prueba';
  const reporte = {
    id: 20,
    usuario_id: 4,
    administrador_id: null,
    tipo_autor: 'usuario',
    usuario_nombre: 'Estudiante de prueba',
    usuario_correo: 'estudiante@example.test',
    administrador_nombre: null,
    titulo: 'Mochila',
    descripcion: 'Mochila negra',
    contacto: 'Contacto de prueba',
    categoria_id: 2,
    categoria_nombre: 'Accesorios',
    fecha_incidente: '2026-10-22',
    fecha: '2026-10-23 12:00',
    campus: 'principal',
    ubicacion_id: 8,
    ubicacion_nombre: 'Biblioteca',
    ubicacion_otro: null,
    imagen: 'mochila.jpg',
    tipo_reporte: 'perdido',
    estado: 'Perdido',
    activo: true,
  };
  const estadisticas = {
    total: 1,
    activos: 1,
    inactivos: 0,
    porEstado: {
      Perdido: 1,
      Encontrado: 0,
      'En servicios': 0,
      Devuelto: 0,
      Donado: 0,
    },
    seriesFechas: [{ fecha: '2026-10-23', count: 1 }],
    seriesUbicaciones: [
      { campus: 'principal', ubicacion: 'Biblioteca', count: 1 },
    ],
  };
  let secretoAnterior;

  function firmarToken(ambito = 'administrador') {
    return jwt.sign({ sub: '31', ambito }, secreto, {
      algorithm: 'HS256',
      issuer: 'FindU',
      expiresIn: '1h',
    });
  }

  function autorizarComo(rol) {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 31,
          nombre: 'Administración vigente',
          correo: 'administracion@example.test',
          rol,
          activo: true,
        },
      ],
    });
  }

  beforeAll(() => {
    secretoAnterior = process.env.JWT_SECRET;
    process.env.JWT_SECRET = secreto;
  });

  afterAll(() => {
    if (secretoAnterior === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = secretoAnterior;
    }
  });

  beforeEach(() => {
    pool.query.mockReset();
    jest
      .spyOn(reportService, 'obtenerReportesAdministrativos')
      .mockResolvedValue([reporte]);
    jest
      .spyOn(reportService, 'obtenerEstadisticas')
      .mockResolvedValue(estadisticas);
    jest.spyOn(reportService, 'obtenerPorId').mockResolvedValue(reporte);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test.each(ROLES_ADMINISTRATIVOS)(
    'permite listado, estadísticas y detalle al rol %s con sus formas exactas',
    async (rol) => {
      autorizarComo(rol);
      autorizarComo(rol);
      autorizarComo(rol);
      const token = firmarToken();

      const listado = await request(app)
        .get('/administradores/reportes')
        .set('Authorization', `Bearer ${token}`);
      const resumen = await request(app)
        .get('/administradores/reportes/estadisticas')
        .set('Authorization', `Bearer ${token}`);
      const detalle = await request(app)
        .get('/administradores/reportes/20')
        .set('Authorization', `Bearer ${token}`);

      expect(listado.status).toBe(200);
      expect(listado.body).toEqual([reporte]);
      expect(resumen.status).toBe(200);
      expect(resumen.body).toEqual(estadisticas);
      expect(detalle.status).toBe(200);
      expect(detalle.body).toEqual(reporte);
      expect(
        reportService.obtenerReportesAdministrativos,
      ).toHaveBeenCalledTimes(1);
      expect(reportService.obtenerEstadisticas).toHaveBeenCalledTimes(1);
      expect(reportService.obtenerPorId).toHaveBeenCalledTimes(1);
      expect(reportService.obtenerPorId).toHaveBeenCalledWith('20');
    },
  );

  test.each([
    '/administradores/reportes',
    '/administradores/reportes/estadisticas',
    '/administradores/reportes/20',
  ])('responde 401 sin token antes de consultar reportes en %s', async (ruta) => {
    const respuesta = await request(app).get(ruta);

    expect(respuesta.status).toBe(401);
    expect(reportService.obtenerReportesAdministrativos).not.toHaveBeenCalled();
    expect(reportService.obtenerEstadisticas).not.toHaveBeenCalled();
    expect(reportService.obtenerPorId).not.toHaveBeenCalled();
  });

  test.each([
    '/administradores/reportes',
    '/administradores/reportes/estadisticas',
    '/administradores/reportes/20',
  ])('responde 403 al JWT estudiantil sin consultar reportes en %s', async (ruta) => {
    const respuesta = await request(app)
      .get(ruta)
      .set('Authorization', `Bearer ${firmarToken('estudiante')}`);

    expect(respuesta.status).toBe(403);
    expect(pool.query).not.toHaveBeenCalled();
    expect(reportService.obtenerReportesAdministrativos).not.toHaveBeenCalled();
    expect(reportService.obtenerEstadisticas).not.toHaveBeenCalled();
    expect(reportService.obtenerPorId).not.toHaveBeenCalled();
  });

  test.each([
    '/administradores/reportes',
    '/administradores/reportes/estadisticas',
    '/administradores/reportes/20',
  ])('responde 403 al rol actual no permitido sin consultar reportes en %s', async (ruta) => {
    autorizarComo('rol_no_permitido');

    const respuesta = await request(app)
      .get(ruta)
      .set('Authorization', `Bearer ${firmarToken()}`);

    expect(respuesta.status).toBe(403);
    expect(reportService.obtenerReportesAdministrativos).not.toHaveBeenCalled();
    expect(reportService.obtenerEstadisticas).not.toHaveBeenCalled();
    expect(reportService.obtenerPorId).not.toHaveBeenCalled();
  });

  test.each(['abc', '999'])(
    'responde 404 exacto para detalle inválido o inexistente %s',
    async (id) => {
      autorizarComo('admin');
      reportService.obtenerPorId.mockResolvedValueOnce(undefined);

      const respuesta = await request(app)
        .get(`/administradores/reportes/${id}`)
        .set('Authorization', `Bearer ${firmarToken()}`);

      expect(respuesta.status).toBe(404);
      expect(respuesta.body).toEqual({ message: 'Reporte no encontrado' });
      expect(reportService.obtenerPorId).toHaveBeenCalledWith(id);
      expect(reportService.obtenerReportesAdministrativos).not.toHaveBeenCalled();
      expect(reportService.obtenerEstadisticas).not.toHaveBeenCalled();
    },
  );
});

describe('regresiones públicas, legacy y mutaciones bloqueadas (T7)', () => {
  const secreto = 'secreto-regresiones-de-prueba';
  let secretoAnterior;

  function firmarTokenAdmin() {
    return jwt.sign({ sub: '31', ambito: 'administrador' }, secreto, {
      algorithm: 'HS256',
      issuer: 'FindU',
      expiresIn: '1h',
    });
  }

  function firmarTokenEstudiante() {
    return jwt.sign({ sub: '42', ambito: 'estudiante' }, secreto, {
      algorithm: 'HS256',
      issuer: 'FindU',
      expiresIn: '1h',
    });
  }

  beforeAll(() => {
    secretoAnterior = process.env.JWT_SECRET;
    process.env.JWT_SECRET = secreto;
  });

  afterAll(() => {
    if (secretoAnterior === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = secretoAnterior;
    }
  });

  beforeEach(() => {
    pool.query.mockReset();
  });

  // --- Rutas legacy inglesas → 404 sin consultas ni mutaciones ---
  test.each([
    '/admins',
    '/admins/login',
    '/admins/reports',
    '/reports',
    '/reports/stats',
    '/reports/1',
    '/delivered',
    '/delivered/1',
    '/administradores/reports',
    '/administradores/reports/stats',
    '/administradores/reports/1',
  ])('responde 404 a la ruta legacy %s sin consultar', async (ruta) => {
    const respuesta = await request(app).get(ruta);

    expect(respuesta.status).toBe(404);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('responde 404 a POST /admins/login sin consultar', async () => {
    const respuesta = await request(app)
      .post('/admins/login')
      .send({ correo: 'admin@example.test', contrasena: 'clave-segura' });

    expect(respuesta.status).toBe(404);
    expect(pool.query).not.toHaveBeenCalled();
  });

  // --- Mutaciones bloqueadas con 403 uniforme ---
  test('PUT /reportes/:id/status responde 403 sin efectos', async () => {
    const respuesta = await request(app)
      .put('/reportes/1/status')
      .send({ estado: 'devuelto' });

    expect(respuesta.status).toBe(403);
    expect(respuesta.body).toEqual({
      message: 'Operación administrativa no habilitada',
    });
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('PUT /reportes/:id/active responde 403 sin efectos', async () => {
    const respuesta = await request(app)
      .put('/reportes/1/active')
      .send({ activo: false });

    expect(respuesta.status).toBe(403);
    expect(respuesta.body).toEqual({
      message: 'Operación administrativa no habilitada',
    });
    expect(pool.query).not.toHaveBeenCalled();
  });

  // --- Regresión de lecturas públicas de specs 001/002 ---
  test('GET /reportes sigue disponible como lectura pública', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const respuesta = await request(app).get('/reportes');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual([]);
  });

  test('GET /reportes/stats sigue disponible como lectura pública', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ total: '0', activos: '0', inactivos: '0' }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const respuesta = await request(app).get('/reportes/stats');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveProperty('total');
    expect(respuesta.body).toHaveProperty('porEstado');
  });

  test('GET /reportes/:id sigue disponible como lectura pública', async () => {
    pool.query.mockResolvedValue({
      rows: [{
        id: 1,
        usuario_id: 4,
        administrador_id: null,
        tipo_autor: 'usuario',
        usuario_nombre: 'Estudiante',
        usuario_correo: 'e@test.test',
        administrador_nombre: null,
        titulo: 'Test',
        descripcion: 'Test',
        contacto: 'Contacto',
        categoria_id: 1,
        categoria_nombre: 'Otros',
        fecha_incidente: '2026-10-22',
        fecha: '2026-10-23 12:00',
        campus: 'principal',
        ubicacion_id: 1,
        ubicacion_nombre: 'Biblioteca',
        ubicacion_otro: null,
        imagen: null,
        tipo_reporte: 'perdido',
        estado: 'perdido',
        activo: true,
      }],
    });

    const respuesta = await request(app).get('/reportes/1');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toHaveProperty('id', 1);
  });

  test('GET /reportes/:id inexistente sigue respondiendo 404', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const respuesta = await request(app).get('/reportes/999');

    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual({ message: 'Reporte no encontrado' });
  });
});
