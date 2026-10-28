const adminService = require('../services/adminService');
const reportService = require('../services/reportService');

async function login(req, res, next) {
  const { correo, contrasena } = req.body || {};

  try {
    const sesion = await adminService.login(correo, contrasena);
    return res.status(200).json(sesion);
  } catch (error) {
    if (error && (error.status === 400 || error.status === 401)) {
      return res.status(error.status).json({ message: error.message });
    }

    return next(
      Object.assign(new Error('No fue posible completar el inicio de sesión'), {
        status: 500,
      }),
    );
  }
}

async function obtenerReportes(_req, res, next) {
  try {
    const reportes = await reportService.obtenerReportesAdministrativos();
    return res.status(200).json(reportes);
  } catch (error) {
    return next(error);
  }
}

async function obtenerEstadisticas(_req, res, next) {
  try {
    const estadisticas = await reportService.obtenerEstadisticas();
    return res.status(200).json(estadisticas);
  } catch (error) {
    return next(error);
  }
}

async function obtenerReportePorId(req, res, next) {
  try {
    const reporte = await reportService.obtenerPorId(req.params.id);
    if (!reporte) {
      return res.status(404).json({ message: 'Reporte no encontrado' });
    }

    return res.status(200).json(reporte);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  login,
  obtenerEstadisticas,
  obtenerReportePorId,
  obtenerReportes,
};
