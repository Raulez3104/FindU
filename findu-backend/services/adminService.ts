import bcrypt from 'bcrypt';
import type { Pool } from 'pg';

import pool = require('../config/database');
import { cargarConfiguracionJwt } from '../config/jwt';
import { esRolAdministrativo } from '../config/roles';
import { emitirSesionAdministrativaJwt } from './authService';
import type {
  ConfiguracionJwt,
  FilaAdministrador,
  PerfilAdministrador,
  SesionJwt,
} from '../types/modelos';

type ClienteConsultas = Pick<Pool, 'query'>;
type CompararContrasena = (
  contrasena: string,
  hash: string,
) => Promise<boolean>;
type EmitirSesionAdministrativa = (
  administrador: PerfilAdministrador,
  opciones: {
    readonly configuracion: Readonly<ConfiguracionJwt>;
    readonly reloj: () => number;
  },
) => Readonly<SesionJwt>;

interface FilaAdministradorCruda {
  readonly id: number;
  readonly nombre: string;
  readonly correo: string;
  readonly contrasena: string;
  readonly rol: unknown;
  readonly activo: boolean;
}

interface DependenciasAdministradores {
  readonly pool?: ClienteConsultas;
  readonly compararContrasena?: CompararContrasena;
  readonly obtenerConfiguracionJwt?: () => Readonly<ConfiguracionJwt>;
  readonly reloj?: () => number;
  readonly emitirSesion?: EmitirSesionAdministrativa;
}

const MENSAJE_CAMPOS_REQUERIDOS = 'Correo y contraseña son requeridos';
const MENSAJE_CREDENCIALES_INVALIDAS =
  'Credenciales administrativas inválidas';

const compararContrasenaPredeterminada: CompararContrasena =
  (contrasena, hash) => bcrypt.compare(contrasena, hash);

function crearError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

function construirPerfilAdministrativo(
  administrador: FilaAdministrador,
): Readonly<PerfilAdministrador> {
  return Object.freeze({
    id: administrador.id,
    nombre: administrador.nombre,
    correo: administrador.correo,
    rol: administrador.rol,
  });
}

function crearServicioAdministradores({
  pool: cliente = pool,
  compararContrasena = compararContrasenaPredeterminada,
  obtenerConfiguracionJwt = cargarConfiguracionJwt,
  reloj = Date.now,
  emitirSesion = emitirSesionAdministrativaJwt,
}: DependenciasAdministradores = {}) {
  async function obtenerPorId(id: number) {
    const result = await cliente.query<FilaAdministrador>(
      `
        SELECT id, nombre, correo, rol, activo
        FROM administradores
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    return result.rows[0] || null;
  }

  async function login(correo: unknown, contrasena: unknown) {
    const correoNormalizado =
      typeof correo === 'string' ? correo.trim() : '';
    const contrasenaPresente =
      typeof contrasena === 'string' && contrasena.trim() !== '';

    if (!correoNormalizado || !contrasenaPresente) {
      throw crearError(MENSAJE_CAMPOS_REQUERIDOS, 400);
    }

    const result = await cliente.query<FilaAdministradorCruda>(
      `
        SELECT id, nombre, correo, contrasena, rol, activo
        FROM administradores
        WHERE LOWER(correo) = LOWER($1)
        ORDER BY id ASC
        LIMIT 1
      `,
      [correoNormalizado],
    );
    const administrador = result.rows[0];

    if (
      !administrador ||
      administrador.activo !== true ||
      !esRolAdministrativo(administrador.rol)
    ) {
      throw crearError(MENSAJE_CREDENCIALES_INVALIDAS, 401);
    }

    const contrasenaCorrecta = await compararContrasena(
      contrasena,
      administrador.contrasena,
    );
    if (!contrasenaCorrecta) {
      throw crearError(MENSAJE_CREDENCIALES_INVALIDAS, 401);
    }

    const perfil = construirPerfilAdministrativo({
      ...administrador,
      rol: administrador.rol,
    });
    const sesion = emitirSesion(perfil, {
      configuracion: obtenerConfiguracionJwt(),
      reloj,
    });

    return Object.freeze({
      token: sesion.token,
      expiraEn: sesion.expiraEn,
      administrador: perfil,
    });
  }

  return Object.freeze({ login, obtenerPorId });
}

const servicioAdministradores = crearServicioAdministradores();

export {
  MENSAJE_CAMPOS_REQUERIDOS,
  MENSAJE_CREDENCIALES_INVALIDAS,
  construirPerfilAdministrativo,
  crearServicioAdministradores,
};

export const login = servicioAdministradores.login;
export const obtenerPorId = servicioAdministradores.obtenerPorId;
