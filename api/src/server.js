import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBooleanEnv, parseListEnv, validateEnvironment } from './config/environment.js';
import { products } from './products.js';
import contactRoutes from './routes/contactRoutes.js';
import adminDashboardRoutes from './routes/adminDashboardRoutes.js';
import adminInquiriesRoutes from './routes/adminInquiriesRoutes.js';
import adminMachinesRoutes from './routes/adminMachinesRoutes.js';
import adminUsersRoutes from './routes/adminUsersRoutes.js';
import adminVisualSparePartsRoutes from './routes/adminVisualSparePartsRoutes.js';
import { adminAccessRequestsRoutes, publicAccessRequestsRoutes } from './routes/accessRequestsRoutes.js';
import authRoutes from './routes/authRoutes.js';
import dbHealthRoutes from './routes/dbHealthRoutes.js';
import machinesRoutes from './routes/machinesRoutes.js';
import machineImagesRoutes from './routes/machineImagesRoutes.js';
import manualSparePartsSearchRoutes from './routes/manualSparePartsSearchRoutes.js';
import visualSparePartsPanelRoutes from './routes/visualSparePartsPanelRoutes.js';
import manualPointsRoutes from './routes/manualPointsRoutes.js';
import setupRoutes from './routes/setupRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createRateLimit } from './middleware/rateLimit.js';
import { requireAdmin } from './middleware/requireAdmin.js';
import { requireActiveUser, requireAuth } from './middleware/requireAuth.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import settingsRoutes from './routes/settingsRoutes.js';
import sparePartsRoutes from './routes/sparePartsRoutes.js';

validateEnvironment();

const app = express();
const port = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const allowedOrigins = parseListEnv(process.env.CLIENT_ORIGIN || 'http://localhost:5173');
const jsonLimitKb = Number.parseInt(process.env.JSON_BODY_LIMIT_KB || '100', 10);
const apiRateLimit = createRateLimit({
  windowMs: Number.parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: Number.parseInt(process.env.API_RATE_LIMIT_MAX || '300', 10),
  message: 'Demasiadas solicitudes. Intentá nuevamente más tarde.'
});
const authRateLimit = createRateLimit({
  windowMs: Number.parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10),
  message: 'Demasiados intentos de acceso. Intentá nuevamente más tarde.'
});

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(securityHeaders);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origen no permitido por CORS.'));
  },
  credentials: parseBooleanEnv(process.env.CORS_CREDENTIALS, false),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true
}));
app.use(express.json({ limit: `${jsonLimitKb}kb` }));
app.use('/api', apiRateLimit);
app.use('/api/auth/login', authRateLimit);
app.use('/api', contactRoutes);
app.use('/api', publicAccessRequestsRoutes);
app.use('/api', authRoutes);
app.use('/api/admin', requireAuth, requireActiveUser, requireAdmin);
app.use('/api/admin', adminAccessRequestsRoutes);
app.use('/api/admin', adminVisualSparePartsRoutes);
app.use('/api', adminDashboardRoutes);
app.use('/api', adminInquiriesRoutes);
app.use('/api', dbHealthRoutes);
app.use('/api', setupRoutes);
app.use('/api', settingsRoutes);
app.use('/api', adminMachinesRoutes);
app.use('/api', machineImagesRoutes);
app.use('/api', adminUsersRoutes);
app.use('/api', machinesRoutes);
app.use('/api', manualSparePartsSearchRoutes);
app.use('/api', visualSparePartsPanelRoutes);
app.use('/api', manualPointsRoutes);
app.use('/api', sparePartsRoutes);

app.get('/api/health', (request, response) => {
  response.json({
    status: 'ok',
    project: 'AgroBarceló API'
  });
});

app.get('/api/products', (request, response) => {
  response.json(products);
});

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`AgroBarceló API escuchando en http://localhost:${port}`);
  }
});
