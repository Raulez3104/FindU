const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { autenticarAdministrador } = require('../middleware/authMiddleware');
const {
  autorizarLecturaAdministrativa,
} = require('../middleware/roleMiddleware');

router.post('/login', adminController.login);
router.get(
  '/reportes',
  autenticarAdministrador,
  autorizarLecturaAdministrativa,
  adminController.obtenerReportes,
);
router.get(
  '/reportes/estadisticas',
  autenticarAdministrador,
  autorizarLecturaAdministrativa,
  adminController.obtenerEstadisticas,
);
router.get(
  '/reportes/:id',
  autenticarAdministrador,
  autorizarLecturaAdministrativa,
  adminController.obtenerReportePorId,
);

module.exports = router;
