import { Router } from 'express';
import { requireActiveUser, requireAuth } from '../middleware/requireAuth.js';
import {
  getManualSparePartsDiagnosticsController,
  searchManualSparePartsController,
  searchVisualSparePartsController
} from '../controllers/manualSparePartsSearchController.js';

const router = Router();

router.get('/buscador-repuestos/diagnostico', requireAuth, requireActiveUser, getManualSparePartsDiagnosticsController);
router.get('/buscador-visual-repuestos', requireAuth, requireActiveUser, searchVisualSparePartsController);
router.get('/buscador-repuestos', requireAuth, requireActiveUser, searchManualSparePartsController);

export default router;
