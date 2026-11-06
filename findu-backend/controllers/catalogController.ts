import type { NextFunction, Request, Response } from 'express';

import * as catalogService from '../services/catalogService';

function obtenerCategorias(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  return catalogService.obtenerCategoriasActivas()
    .then(categorias => res.json(categorias))
    .catch(next);
}

function obtenerUbicaciones(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  return catalogService.obtenerUbicacionesActivas(
    req.query.campus as string | undefined,
  )
    .then(ubicaciones => res.json(ubicaciones))
    .catch(next);
}

export { obtenerCategorias, obtenerUbicaciones };
