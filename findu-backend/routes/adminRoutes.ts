import express from 'express';

import * as adminController from '../controllers/adminController';
import upload = require('../config/upload');
import { autenticarAdministrador } from '../middleware/authMiddleware';
import {
  manejarErrorJsonInvalido,
  parsearJsonRuta,
} from '../middleware/jsonRuta';
import {
  autorizarAltaReporte,
  autorizarArchivoReporte,
  autorizarCierreReporte,
  autorizarDevolucionReporte,
  autorizarDonacionReporte,
  autorizarEdicionReporte,
  autorizarLecturaAdministrativa,
  autorizarReactivacionReporte,
  autorizarRecepcionReporte,
} from '../middleware/roleMiddleware';
import { validarIdRuta } from '../middleware/validarIdRuta';

const router = express.Router();

router.post(
  '/login',
  parsearJsonRuta,
  manejarErrorJsonInvalido,
  adminController.login,
);
router.post(
  '/reportes',
  autenticarAdministrador,
  autorizarAltaReporte,
  upload.single('image'),
  adminController.crearReporte,
);
router.post(
  '/reportes/:id/recepcion',
  autenticarAdministrador,
  autorizarRecepcionReporte,
  validarIdRuta,
  parsearJsonRuta,
  manejarErrorJsonInvalido,
  adminController.recepcionarReporte,
);
router.post(
  '/reportes/:id/devolucion',
  autenticarAdministrador,
  autorizarDevolucionReporte,
  validarIdRuta,
  parsearJsonRuta,
  manejarErrorJsonInvalido,
  adminController.devolverReporte,
);
router.post(
  '/reportes/:id/cierre',
  autenticarAdministrador,
  autorizarCierreReporte,
  validarIdRuta,
  parsearJsonRuta,
  manejarErrorJsonInvalido,
  adminController.cerrarReportePerdido,
);
router.post(
  '/reportes/:id/donacion',
  autenticarAdministrador,
  autorizarDonacionReporte,
  validarIdRuta,
  parsearJsonRuta,
  manejarErrorJsonInvalido,
  adminController.donarReporte,
);
router.patch(
  '/reportes/:id',
  autenticarAdministrador,
  autorizarEdicionReporte,
  validarIdRuta,
  parsearJsonRuta,
  manejarErrorJsonInvalido,
  adminController.editarReporte,
);
router.post(
  '/reportes/:id/archivo',
  autenticarAdministrador,
  autorizarArchivoReporte,
  validarIdRuta,
  parsearJsonRuta,
  manejarErrorJsonInvalido,
  adminController.archivarReporte,
);
router.post(
  '/reportes/:id/reactivacion',
  autenticarAdministrador,
  autorizarReactivacionReporte,
  validarIdRuta,
  parsearJsonRuta,
  manejarErrorJsonInvalido,
  adminController.reactivarReporte,
);
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
  '/reportes/:id/historial',
  autenticarAdministrador,
  autorizarLecturaAdministrativa,
  validarIdRuta,
  adminController.obtenerTrazaReporte,
);
router.get(
  '/reportes/:id/candidatos-cierre',
  autenticarAdministrador,
  autorizarLecturaAdministrativa,
  validarIdRuta,
  adminController.obtenerCandidatosCierre,
);
router.get(
  '/reportes/:id',
  autenticarAdministrador,
  autorizarLecturaAdministrativa,
  adminController.obtenerReportePorId,
);

export = router;
