import express from 'express';
import type { NextFunction, Request, Response } from 'express';

type ErrorParseoJson = SyntaxError & {
  readonly status?: number;
  readonly type?: string;
};

const parsearJsonRuta = express.json();

function manejarErrorJsonInvalido(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  const errorParseo = error as ErrorParseoJson;
  if (
    error instanceof SyntaxError &&
    errorParseo.status === 400 &&
    errorParseo.type === 'entity.parse.failed'
  ) {
    return res.status(400).json({ message: 'JSON inválido' });
  }

  return next(error);
}

export { manejarErrorJsonInvalido, parsearJsonRuta };
