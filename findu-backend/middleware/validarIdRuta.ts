import type { NextFunction, Request, Response } from 'express';

const ID_MAXIMO = 2147483647;

function validarIdRuta(req: Request, res: Response, next: NextFunction) {
  const idTexto = req.params.id;
  if (typeof idTexto !== 'string' || !/^[1-9]\d*$/.test(idTexto)) {
    return res.status(404).json({ message: 'Reporte no encontrado' });
  }

  const id = Number(idTexto);
  if (!Number.isSafeInteger(id) || id > ID_MAXIMO) {
    return res.status(404).json({ message: 'Reporte no encontrado' });
  }

  return next();
}

export { validarIdRuta };
