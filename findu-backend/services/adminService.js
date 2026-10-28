const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { cargarConfiguracionJwt } = require('../config/jwt');
const { esRolAdministrativo } = require('../config/roles');
const { emitirSesionAdministrativaJwt } = require('./authService');

const MENSAJE_CAMPOS_REQUERIDOS = 'Correo y contraseña son requeridos';
const MENSAJE_CREDENCIALES_INVALIDAS =
  'Credenciales administrativas inválidas';

function crearError(message, status) {
  return Object.assign(new Error(message), { status });
}

function construirPerfilAdministrativo(administrador) {
  return Object.freeze({
    id: administrador.id,
    nombre: administrador.nombre,
    correo: administrador.correo,
    rol: administrador.rol,
  });
}

function crearServicioAdministradores({
  pool: cliente = pool,
  compararContrasena = bcrypt.compare,
  obtenerConfiguracionJwt = cargarConfiguracionJwt,
  reloj = Date.now,
  emitirSesion = emitirSesionAdministrativaJwt,
} = {}) {
  async function obtenerPorId(id) {
    const result = await cliente.query(
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

  async function login(correo, contrasena) {
    const correoNormalizado =
      typeof correo === 'string' ? correo.trim() : '';
    const contrasenaPresente =
      typeof contrasena === 'string' && contrasena.trim() !== '';

    if (!correoNormalizado || !contrasenaPresente) {
      throw crearError(MENSAJE_CAMPOS_REQUERIDOS, 400);
    }

    const result = await cliente.query(
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

    const perfil = construirPerfilAdministrativo(administrador);
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

module.exports = {
  MENSAJE_CAMPOS_REQUERIDOS,
  MENSAJE_CREDENCIALES_INVALIDAS,
  construirPerfilAdministrativo,
  crearServicioAdministradores,
  login: servicioAdministradores.login,
  obtenerPorId: servicioAdministradores.obtenerPorId,
};
