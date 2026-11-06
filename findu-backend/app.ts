import dotenv = require('dotenv');

dotenv.config();

import { createServer } from './config/server';
import reportRoutes = require('./routes/reportRoutes');
import userRoutes = require('./routes/userRoutes');
import adminRoutes = require('./routes/adminRoutes');
import catalogRoutes = require('./routes/catalogRoutes');
import errorHandler = require('./middleware/errorHandler');

const { rutasCategorias, rutasUbicaciones } = catalogRoutes;
const app = createServer();

app.use('/reportes', reportRoutes);
app.use('/usuarios', userRoutes);
app.use('/administradores', adminRoutes);
app.use('/categorias', rutasCategorias);
app.use('/ubicaciones', rutasUbicaciones);

app.use(errorHandler);

export = app;
