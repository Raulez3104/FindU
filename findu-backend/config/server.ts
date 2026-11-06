import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';

let raizModulo = __dirname;
while (!fs.existsSync(path.join(raizModulo, 'package.json'))) {
  const directorioPadre = path.dirname(raizModulo);
  if (directorioPadre === raizModulo) {
    throw new Error('No se encontró la raíz del backend');
  }
  raizModulo = directorioPadre;
}

const uploadsDir = path.join(raizModulo, 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Carpeta uploads/ creada');
}

function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use('/uploads', express.static(uploadsDir));

  return app;
}

export { createServer, uploadsDir };
