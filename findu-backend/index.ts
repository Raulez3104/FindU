import dotenv = require('dotenv');

dotenv.config();

import app = require('./app');
import { uploadsDir } from './config/server';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\nServidor corriendo en http://localhost:${PORT}`);
  console.log(`Carpeta de uploads: ${uploadsDir}`);
  console.log(`Acceso a imágenes: http://localhost:${PORT}/uploads/`);
});
