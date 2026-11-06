import express from 'express';

import * as adminController from '../controllers/adminController';
import { autenticarAdministrador } from '../middleware/authMiddleware';
import { autorizarLecturaAdministrativa } from '../middleware/roleMiddleware';

const router = express.Router();

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

export = router;
