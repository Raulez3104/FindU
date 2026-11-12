jest.mock('../config/database', () => ({ query: jest.fn() }));

import type { NextFunction, Request, Response } from 'express';
import express = require('express');
import request = require('supertest');

import app = require('../app');
import errorHandler = require('../middleware/errorHandler');
import {
  crearAutenticadorAdministrativo,
} from '../middleware/authMiddleware';
import {
  manejarErrorJsonInvalido,
  parsearJsonRuta,
} from '../middleware/jsonRuta';
import { crearAutorizadorPorRoles } from '../middleware/roleMiddleware';
import { validarIdRuta } from '../middleware/validarIdRuta';
import type { FilaAdministrador } from '../types/modelos';

const CUERPO_JSON_MALFORMADO = '{"estado":';

function crearAplicacionPipeline({
  payload = { sub: '31', ambito: 'administrador' },
  administrador = {
    id: 31,
    nombre: 'Administración de prueba',
    correo: 'admin@example.test',
    rol: 'admin',
    activo: true,
  } as FilaAdministrador,
  errorJwt,
}: {
  readonly payload?: Record<string, unknown>;
  readonly administrador?: FilaAdministrador | null;
  readonly errorJwt?: Error;
} = {}) {
  const aplicacion = express();
  const consultarReporte = jest.fn((_req: Request, res: Response) => {
    res.status(204).end();
  });
  const autenticar = crearAutenticadorAdministrativo({
    obtenerConfiguracionJwt: () => ({
      secret: 'secreto-de-prueba',
      expiracionHoras: 24,
      emisor: 'FindU',
    }),
    verificarJwt: () => {
      if (errorJwt) throw errorJwt;
      return payload;
    },
    obtenerAdministradorPorId: async () => administrador,
  });
  const autorizar = crearAutorizadorPorRoles(['admin', 'personal_servicios']);
  const validarForma = (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    if (
      typeof req.body !== 'object' ||
      req.body === null ||
      Array.isArray(req.body) ||
      Object.keys(req.body as object).length > 0
    ) {
      return res.status(400).json({ message: 'Cuerpo de solicitud inválido' });
    }
    return next();
  };

  aplicacion.post(
    '/reportes/:id/recepcion',
    autenticar,
    autorizar,
    validarIdRuta,
    parsearJsonRuta,
    manejarErrorJsonInvalido,
    validarForma,
    consultarReporte,
  );
  aplicacion.use(errorHandler);

  return { aplicacion, consultarReporte };
}

function solicitudJsonMalformado(aplicacion: express.Express, id = '1') {
  return request(aplicacion)
    .post(`/reportes/${id}/recepcion`)
    .set('Content-Type', 'application/json')
    .send(CUERPO_JSON_MALFORMADO);
}

describe('pipeline JSON local para mutaciones administrativas', () => {
  test('prioriza 401 sin JWT sobre un JSON malformado', async () => {
    const { aplicacion, consultarReporte } = crearAplicacionPipeline();

    const respuesta = await solicitudJsonMalformado(aplicacion);

    expect(respuesta.status).toBe(401);
    expect(consultarReporte).not.toHaveBeenCalled();
  });

  test.each(['inválido', 'vencido'])(
    'prioriza 401 para un JWT %s sobre un JSON malformado',
    async () => {
      const { aplicacion, consultarReporte } = crearAplicacionPipeline({
        errorJwt: new Error('JWT rechazado'),
      });

      const respuesta = await solicitudJsonMalformado(aplicacion).set(
        'Authorization',
        'Bearer jwt-de-prueba',
      );

      expect(respuesta.status).toBe(401);
      expect(consultarReporte).not.toHaveBeenCalled();
    },
  );

  test('prioriza 403 para un JWT estudiantil sobre un JSON malformado', async () => {
    const { aplicacion, consultarReporte } = crearAplicacionPipeline({
      payload: { sub: '42', ambito: 'estudiante' },
    });

    const respuesta = await solicitudJsonMalformado(aplicacion).set(
      'Authorization',
      'Bearer jwt-estudiantil-de-prueba',
    );

    expect(respuesta.status).toBe(403);
    expect(consultarReporte).not.toHaveBeenCalled();
  });

  test.each(['superadmin', 'rol_desconocido'])(
    'prioriza 403 para el rol vigente %s sobre un JSON malformado',
    async (rol) => {
      const { aplicacion, consultarReporte } = crearAplicacionPipeline({
        administrador: {
          id: 31,
          nombre: 'Administración de prueba',
          correo: 'admin@example.test',
          rol,
          activo: true,
        } as FilaAdministrador,
      });

      const respuesta = await solicitudJsonMalformado(aplicacion).set(
        'Authorization',
        'Bearer jwt-administrativo-de-prueba',
      );

      expect(respuesta.status).toBe(403);
      expect(consultarReporte).not.toHaveBeenCalled();
    },
  );

  test('prioriza 404 de ID inválido sobre un JSON malformado', async () => {
    const { aplicacion, consultarReporte } = crearAplicacionPipeline();

    const respuesta = await solicitudJsonMalformado(aplicacion, 'abc').set(
      'Authorization',
      'Bearer jwt-administrativo-de-prueba',
    );

    expect(respuesta.status).toBe(404);
    expect(respuesta.body).toEqual({ message: 'Reporte no encontrado' });
    expect(consultarReporte).not.toHaveBeenCalled();
  });

  test('responde 400 seguro al JSON malformado con ID válido', async () => {
    const { aplicacion, consultarReporte } = crearAplicacionPipeline();

    const respuesta = await solicitudJsonMalformado(aplicacion, '999').set(
      'Authorization',
      'Bearer jwt-administrativo-de-prueba',
    );

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toEqual({ message: 'JSON inválido' });
    expect(consultarReporte).not.toHaveBeenCalled();
  });

  test('deja la forma básica después del parser y antes de consultar', async () => {
    const { aplicacion, consultarReporte } = crearAplicacionPipeline();

    const respuesta = await request(aplicacion)
      .post('/reportes/999/recepcion')
      .set('Authorization', 'Bearer jwt-administrativo-de-prueba')
      .send({ campo_no_admitido: true });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toEqual({ message: 'Cuerpo de solicitud inválido' });
    expect(consultarReporte).not.toHaveBeenCalled();
  });
});

describe('parsers locales y rutas legacy retiradas', () => {
  test.each([
    '/reportes/1/status',
    '/reportes/1/active',
  ])('mantiene 404 en PUT %s antes de token y JSON malformado', async (ruta) => {
    for (const authorization of [undefined, 'Bearer token-cualquiera']) {
      let solicitud = request(app)
        .put(ruta)
        .set('Content-Type', 'application/json')
        .send(CUERPO_JSON_MALFORMADO);
      if (authorization) solicitud = solicitud.set('Authorization', authorization);

      const respuesta = await solicitud;

      expect(respuesta.status).toBe(404);
    }
  });

  test.each([
    '/administradores/login',
    '/usuarios/iniciar-sesion-google',
  ])('normaliza JSON malformado en el login %s', async (ruta) => {
    const respuesta = await request(app)
      .post(ruta)
      .set('Content-Type', 'application/json')
      .send(CUERPO_JSON_MALFORMADO);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body).toEqual({ message: 'JSON inválido' });
  });

  test('conserva JWT antes de Multer en el alta multipart estudiantil', async () => {
    const respuesta = await request(app)
      .post('/reportes')
      .field('titulo', 'Reporte de prueba');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toEqual({ message: 'Autenticación requerida' });
  });
});
