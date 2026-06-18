import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { products } from './products.js';
import contactRoutes from './routes/contactRoutes.js';
import adminDashboardRoutes from './routes/adminDashboardRoutes.js';
import adminInquiriesRoutes from './routes/adminInquiriesRoutes.js';
import adminMachinesRoutes from './routes/adminMachinesRoutes.js';
import adminUsersRoutes from './routes/adminUsersRoutes.js';
import accessRequestsRoutes from './routes/accessRequestsRoutes.js';
import authRoutes from './routes/authRoutes.js';
import dbHealthRoutes from './routes/dbHealthRoutes.js';
import machinesRoutes from './routes/machinesRoutes.js';
import machineImagesRoutes from './routes/machineImagesRoutes.js';
import manualSparePartsSearchRoutes from './routes/manualSparePartsSearchRoutes.js';
import setupRoutes from './routes/setupRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import sparePartsRoutes from './routes/sparePartsRoutes.js';

const app = express();
const port = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: clientOrigin }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use('/api', contactRoutes);
app.use('/api', accessRequestsRoutes);
app.use('/api', authRoutes);
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

app.listen(port, () => {
  console.log(`AgroBarceló API escuchando en http://localhost:${port}`);
});
