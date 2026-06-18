import { Router } from 'express';
import { getAdminDashboardController } from '../controllers/adminDashboardController.js';

const router = Router();

router.get('/admin/dashboard', getAdminDashboardController);

export default router;
