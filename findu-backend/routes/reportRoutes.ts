import express from 'express';

import upload = require('../config/upload');
import * as reportController from '../controllers/reportController';
import { autenticar } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/', autenticar, upload.single('image'), reportController.crear);
router.get('/', reportController.obtenerTodos);
router.get('/stats', reportController.obtenerEstadisticas);
router.get('/usuario/:usuarioId', autenticar, reportController.obtenerPorUsuario);
router.get('/:id', reportController.obtenerPorId);

export = router;
