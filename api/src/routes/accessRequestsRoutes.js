import { Router } from 'express';
import {
  createAccessRequestController,
  getAdminAccessRequestDetailController,
  getAdminAccessRequestsController,
  updateAdminAccessRequestStatusController
} from '../controllers/accessRequestsController.js';

const publicAccessRequestsRoutes = Router();
const adminAccessRequestsRoutes = Router();

publicAccessRequestsRoutes.post('/solicitudes-acceso', createAccessRequestController);
adminAccessRequestsRoutes.get('/solicitudes-acceso', getAdminAccessRequestsController);
adminAccessRequestsRoutes.get('/solicitudes-acceso/:id', getAdminAccessRequestDetailController);
adminAccessRequestsRoutes.patch('/solicitudes-acceso/:id/estado', updateAdminAccessRequestStatusController);

export { adminAccessRequestsRoutes, publicAccessRequestsRoutes };
