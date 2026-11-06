import type { NextFunction, Request, Response } from 'express';

import * as adminService from '../services/adminService';
import * as reportService from '../services/reportService';

async function login(req: Request, res: Response, next: NextFunction) {
  const { correo, contrasena } = (req.body || {}) as {
    readonly correo?: unknown;
    readonly contrasena?: unknown;
  };

  try {
    const sesion = await adminService.login(correo, contrasena);
    return res.status(200).json(sesion);
  } catch (error) {
    const errorControlado = error as {
      readonly status?: unknown;
      readonly message?: string;
    };
    if (
      error &&
      (errorControlado.status === 400 || errorControlado.status === 401)
    ) {
      return res
        .status(errorControlado.status)
        .json({ message: errorControlado.message });
    }

    return next(
      Object.assign(new Error('No fue posible completar el inicio de sesión'), {
        status: 500,
      }),
    );
  }
}

async function obtenerReportes(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const reportes = await reportService.obtenerReportesAdministrativos();
    return res.status(200).json(reportes);
  } catch (error) {
    return next(error);
  }
}

async function obtenerEstadisticas(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const estadisticas = await reportService.obtenerEstadisticas();
    return res.status(200).json(estadisticas);
  } catch (error) {
    return next(error);
  }
}

async function obtenerReportePorId(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const reporte = await reportService.obtenerPorId(req.params.id);
    if (!reporte) {
      return res.status(404).json({ message: 'Reporte no encontrado' });
    }

    return res.status(200).json(reporte);
  } catch (error) {
    return next(error);
  }
}

export {
  login,
  obtenerEstadisticas,
  obtenerReportePorId,
  obtenerReportes,
};
