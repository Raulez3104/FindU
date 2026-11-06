import express from 'express';

import * as userController from '../controllers/userController';
import {
  autenticar,
  bloquearRutaNoEstudiantil,
} from '../middleware/authMiddleware';

const router = express.Router();

router.post('/iniciar-sesion-google', userController.iniciarSesionGoogle);
router.get('/', autenticar, bloquearRutaNoEstudiantil);
router.post('/', autenticar, bloquearRutaNoEstudiantil);
router.get('/by-email/:email', autenticar, bloquearRutaNoEstudiantil);
router.put('/:id/active', autenticar, bloquearRutaNoEstudiantil);
router.get('/:id', autenticar, userController.obtenerPorId);

export = router;
