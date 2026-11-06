import type { NextFunction, Request, Response } from 'express';

import * as reportService from '../services/reportService';

function crear(req: Request, res: Response, next: NextFunction) {
  const imagenPath = req.file ? req.file.filename : null;
  const autor = { tipo: 'usuario' as const, id: req.usuario!.id };
  const datos: unknown = req.body;
  return reportService.crearReporte({ autor, datos, imagenPath })
    .then(result => {
      res.status(201).json({
        message: 'Reporte guardado correctamente',
        id: result.id,
        imagen: result.imagen,
        imageUrl: reportService.buildImageUrl(req, result.imagen)
      });
    })
    .catch(next);
}

function obtenerTodos(req: Request, res: Response) {
  reportService.obtenerTodosLosReportes()
    .then(results => {
      const reportsWithImages = results.map(report => ({
        ...report,
        imageUrl: reportService.buildImageUrl(req, report.imagen)
      }));
      res.json(reportsWithImages);
    })
    .catch((err: unknown) => {
      console.error('Error SQL:', err);
      res.status(500).json({ message: 'Error al obtener los reportes' });
    });
}

async function obtenerPorUsuario(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const results = await reportService.obtenerReportesPorUsuario(
      req.params.usuarioId,
      req.usuario!.id,
    );
    const reportsWithImages = results.map(report => ({
      ...report,
      imageUrl: reportService.buildImageUrl(req, report.imagen)
    }));
    return res.json({ reports: reportsWithImages });
  } catch (error) {
    return next(error);
  }
}

function obtenerPorId(req: Request, res: Response) {
  const { id } = req.params;

  reportService.obtenerPorId(id)
    .then(report => {
      if (!report) {
        return res.status(404).json({ message: 'Reporte no encontrado' });
      }
      res.json({
        ...report,
        imageUrl: reportService.buildImageUrl(req, report.imagen)
      });
    })
    .catch((err: unknown) => {
      console.error('Error SQL:', err);
      res.status(500).json({ message: 'Error al obtener el reporte' });
    });
}

function obtenerEstadisticas(_req: Request, res: Response) {
  reportService.obtenerEstadisticas()
    .then(stats => res.json(stats))
    .catch((err: unknown) => {
      console.error('Error SQL stats:', err);
      res.status(500).json({ message: 'Error al obtener estadísticas de reportes' });
    });
}

function actualizarEstado(_req: Request, res: Response) {
  return res.status(403).json({ message: 'Operación administrativa no habilitada' });
}

function actualizarActivo(_req: Request, res: Response) {
  return res.status(403).json({ message: 'Operación administrativa no habilitada' });
}

export {
  crear,
  obtenerTodos,
  obtenerPorUsuario,
  obtenerPorId,
  obtenerEstadisticas,
  actualizarEstado,
  actualizarActivo,
};
