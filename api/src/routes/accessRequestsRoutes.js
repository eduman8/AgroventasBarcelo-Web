import { Router } from 'express';
import {
  createAccessRequestController,
  getAdminAccessRequestDetailController,
  getAdminAccessRequestsController,
  updateAdminAccessRequestStatusController
} from '../controllers/accessRequestsController.js';

const router = Router();

router.post('/solicitudes-acceso', createAccessRequestController);
router.get('/admin/solicitudes-acceso', getAdminAccessRequestsController);
router.get('/admin/solicitudes-acceso/:id', getAdminAccessRequestDetailController);
router.patch('/admin/solicitudes-acceso/:id/estado', updateAdminAccessRequestStatusController);

export default router;
