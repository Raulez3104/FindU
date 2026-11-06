import type { NextFunction, Request, Response } from 'express';

import * as authService from '../services/authService';
import * as userService from '../services/userService';

interface CuerpoUsuario {
  readonly name?: unknown;
  readonly nombre?: unknown;
  readonly email?: unknown;
  readonly correo?: unknown;
  readonly picture?: unknown;
  readonly foto?: unknown;
  readonly is_active?: unknown;
  readonly activo?: unknown;
}

const MENSAJE_IDENTIDAD_INVALIDA =
  'No fue posible verificar la identidad institucional';
const MENSAJE_CUENTA_INACTIVA = 'La cuenta institucional no está activa';

async function iniciarSesionGoogle(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { idToken } = (req.body || {}) as { readonly idToken?: unknown };

  if (typeof idToken !== 'string' || idToken.trim() === '') {
    return res.status(401).json({ message: MENSAJE_IDENTIDAD_INVALIDA });
  }

  try {
    const { token, expiraEn, usuario } =
      await authService.autenticarConGoogle(idToken);
    return res.status(200).json({
      token,
      expiraEn,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        foto: usuario.foto,
      },
    });
  } catch (error) {
    const errorControlado = error as {
      readonly status?: unknown;
      readonly message?: string;
    };
    if (error && errorControlado.status === 401) {
      const message = errorControlado.message === MENSAJE_CUENTA_INACTIVA
        ? MENSAJE_CUENTA_INACTIVA
        : MENSAJE_IDENTIDAD_INVALIDA;
      return res.status(401).json({ message });
    }

    const errorSeguro = Object.assign(
      new Error('No fue posible completar el inicio de sesión'),
      { status: 500 },
    );
    return next(errorSeguro);
  }
}

function listar(_req: Request, res: Response) {
  userService.listarTodos()
    .then(usuarios => res.json({ usuarios }))
    .catch((_err: unknown) => res.status(500).json({ message: 'Error al obtener usuarios' }));
}

function crear(req: Request, res: Response) {
  const { name, nombre, email, correo, picture, foto } =
    req.body as CuerpoUsuario;

  userService.crear({ name, nombre, email, correo, picture, foto })
    .then(result => res.status(201).json({ message: 'Usuario creado', id: result.id }))
    .catch((err: unknown) => {
      const error = err as {
        readonly message?: string;
        readonly duplicate?: unknown;
        readonly id?: unknown;
      };
      if (error.message && error.message.includes('requerido')) {
        return res.status(400).json({ message: error.message });
      }
      if (error.duplicate) {
        return res.status(409).json({ message: 'El correo ya existe', id: error.id });
      }
      res.status(500).json({ message: 'Error al crear usuario' });
    });
}

async function obtenerPorId(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  let id;
  try {
    id = userService.validarIdUsuario(req.params.id);
  } catch (error) {
    const errorControlado = error as {
      readonly status?: unknown;
      readonly message?: string;
    };
    if (error && errorControlado.status === 400) {
      return res.status(400).json({ message: errorControlado.message });
    }
    return next(error);
  }

  if (id !== req.usuario!.id) {
    return res.status(403).json({ message: 'No puede consultar otro perfil' });
  }

  try {
    const rows = await userService.obtenerPorId(id);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Sesión inválida o expirada' });
    }

    const usuario = rows[0];
    return res.json({
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        foto: usuario.foto || null,
        activo: usuario.activo,
        fecha_creacion: usuario.fecha_creacion,
      },
    });
  } catch (error) {
    return next(error);
  }
}

function obtenerPorCorreo(req: Request, res: Response) {
  const { email } = req.params;

  userService.buscarPorCorreo(email)
    .then(rows => {
      if (rows.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });
      res.json({ usuario: rows[0] });
    })
    .catch((_err: unknown) => res.status(500).json({ message: 'Error al buscar por correo' }));
}

function actualizarActivo(req: Request, res: Response) {
  const { id } = req.params;
  let { is_active, activo } = req.body as CuerpoUsuario;

  activo = activo !== undefined ? activo : is_active;

  if (!(activo === 0 || activo === 1 || activo === '0' || activo === '1' || activo === true || activo === false)) {
    return res.status(400).json({ message: 'activo debe ser true/false o 0/1' });
  }

  const val = activo === 1 || activo === '1' || activo === true ? 1 : 0;

  userService.actualizarActivo(id, val)
    .then(result => res.json({ message: 'Estado de actividad actualizado', ...result }))
    .catch((err: unknown) => {
      const error = err as { readonly notFound?: unknown };
      if (error.notFound) return res.status(404).json({ message: 'Usuario no encontrado' });
      res.status(500).json({ message: 'Error al actualizar estado de actividad' });
    });
}

export {
  iniciarSesionGoogle,
  listar,
  crear,
  obtenerPorId,
  obtenerPorCorreo,
  actualizarActivo,
};
