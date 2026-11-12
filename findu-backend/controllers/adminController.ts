import type { NextFunction, Request, Response } from 'express';

import * as adminService from '../services/adminService';
import * as reportService from '../services/reportService';
import * as servicioOperaciones from '../services/servicioOperacionesReportes';

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

async function crearReporte(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const autor = { tipo: 'admin' as const, id: req.administrador!.id };
    const imagenPath = req.file?.filename;
    const resultado = await reportService.crearReporte({
      autor,
      datos: req.body,
      imagenPath,
    });

    return res.status(201).json({
      message: 'Reporte creado exitosamente',
      id: resultado.id,
      imagen: resultado.imagen,
      imageUrl: `/uploads/${resultado.imagen}`,
      estado: 'En servicios',
    });
  } catch (error) {
    return next(error);
  }
}

async function recepcionarReporte(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = Number(req.params.id);
    const actor = req.administrador!;
    const resultado = await servicioOperaciones.ejecutarOperacionReporte({
      id,
      operacion: 'recepcion',
      actor,
      payload: req.body,
    });

    return res.status(200).json(resultado);
  } catch (error) {
    return next(error);
  }
}

async function devolverReporte(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = Number(req.params.id);
    const actor = req.administrador!;
    const resultado = await servicioOperaciones.ejecutarOperacionReporte({
      id,
      operacion: 'devolucion',
      actor,
      payload: req.body,
    });

    return res.status(200).json(resultado);
  } catch (error) {
    return next(error);
  }
}

async function cerrarReportePerdido(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = Number(req.params.id);
    const actor = req.administrador!;
    const resultado = await servicioOperaciones.ejecutarOperacionReporte({
      id,
      operacion: 'cierre',
      actor,
      payload: req.body,
    });

    return res.status(200).json(resultado);
  } catch (error) {
    return next(error);
  }
}

async function donarReporte(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = Number(req.params.id);
    const actor = req.administrador!;
    const resultado = await servicioOperaciones.ejecutarOperacionReporte({
      id,
      operacion: 'donacion',
      actor,
      payload: req.body,
    });

    return res.status(200).json(resultado);
  } catch (error) {
    return next(error);
  }
}

async function editarReporte(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = Number(req.params.id);
    const actor = req.administrador!;
    const resultado = await servicioOperaciones.ejecutarOperacionReporte({
      id,
      operacion: 'edicion',
      actor,
      payload: req.body,
    });

    return res.status(200).json(resultado);
  } catch (error) {
    return next(error);
  }
}

async function archivarReporte(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = Number(req.params.id);
    const actor = req.administrador!;
    const resultado = await servicioOperaciones.ejecutarOperacionReporte({
      id,
      operacion: 'archivo',
      actor,
      payload: req.body,
    });

    return res.status(200).json(resultado);
  } catch (error) {
    return next(error);
  }
}

async function reactivarReporte(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = Number(req.params.id);
    const actor = req.administrador!;
    const resultado = await servicioOperaciones.ejecutarOperacionReporte({
      id,
      operacion: 'reactivacion',
      actor,
      payload: req.body,
    });

    return res.status(200).json(resultado);
  } catch (error) {
    return next(error);
  }
}

async function obtenerTrazaReporte(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = Number(req.params.id);
    const traza = await servicioOperaciones.consultarTrazaReporte(id);
    return res.status(200).json(traza);
  } catch (error) {
    return next(error);
  }
}

async function obtenerCandidatosCierre(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = Number(req.params.id);
    const busqueda = typeof req.query.busqueda === 'string' ? req.query.busqueda : undefined;
    const candidatos = await servicioOperaciones.consultarCandidatosCierre(id, busqueda);
    return res.status(200).json(candidatos);
  } catch (error) {
    return next(error);
  }
}

export {
  archivarReporte,
  cerrarReportePerdido,
  crearReporte,
  devolverReporte,
  donarReporte,
  editarReporte,
  login,
  obtenerCandidatosCierre,
  obtenerEstadisticas,
  obtenerReportePorId,
  obtenerReportes,
  obtenerTrazaReporte,
  reactivarReporte,
  recepcionarReporte,
};
