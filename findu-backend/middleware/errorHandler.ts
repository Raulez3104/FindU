import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (err instanceof multer.MulterError) {
    console.error('Error de Multer:', err);
    return res.status(400).json({
      message: 'Error al subir la imagen',
      error: err.message
    });
  } else if (err) {
    console.error('Error:', err);
    const error = err as { message?: unknown; status?: unknown };
    const status =
      typeof error.status === 'number' &&
      Number.isInteger(error.status) &&
      error.status >= 400 &&
      error.status <= 599
        ? error.status
        : 500;
    return res.status(status).json({
      message: error.message || 'Error del servidor'
    });
  }
  next();
}

export = errorHandler;
