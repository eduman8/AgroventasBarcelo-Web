import { Router } from 'express';
import { getPublicManualPointsController } from '../controllers/visualSparePartsPanelController.js';

const router = Router();
router.get('/manual-puntos', getPublicManualPointsController);
export default router;
