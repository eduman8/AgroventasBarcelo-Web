import { Router } from 'express';
import { requireActiveUser, requireAuth } from '../middleware/requireAuth.js';
import { getVisualSparePartsPanelController } from '../controllers/visualSparePartsPanelController.js';

const router = Router();
router.get('/buscador-visual-repuestos/panel', requireAuth, requireActiveUser, getVisualSparePartsPanelController);
export default router;
