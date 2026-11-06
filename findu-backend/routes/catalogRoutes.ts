import express from 'express';

import * as catalogController from '../controllers/catalogController';

const rutasCategorias = express.Router();
const rutasUbicaciones = express.Router();

rutasCategorias.get('/', catalogController.obtenerCategorias);
rutasUbicaciones.get('/', catalogController.obtenerUbicaciones);

export = { rutasCategorias, rutasUbicaciones };
