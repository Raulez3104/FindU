import multer from 'multer';
import path from 'node:path';

import type { ErrorConEstado } from '../types/modelos';
import { uploadsDir } from './server';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extname = ['.jpeg', '.jpg', '.png'].includes(path.extname(file.originalname).toLowerCase());
    const mimetype = ['image/jpeg', 'image/jpg', 'image/png'].includes(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      const error: ErrorConEstado = Object.assign(
        new Error('Solo se permiten imágenes JPG, JPEG y PNG'),
        { status: 400 },
      );
      cb(error);
    }
  }
});

export = upload;
