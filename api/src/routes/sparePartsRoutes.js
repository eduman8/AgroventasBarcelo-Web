import { Router } from 'express';
import { requireActiveUser, requireAuth } from '../middleware/requireAuth.js';
import {
  getSparePartByIdController,
  getSparePartsController,
  getSparePartsCountController
} from '../controllers/sparePartsController.js';

const router = Router();

router.get('/repuestos/count', requireAuth, requireActiveUser, getSparePartsCountController);
router.get('/repuestos', requireAuth, requireActiveUser, getSparePartsController);
router.get('/repuestos/:id', requireAuth, requireActiveUser, getSparePartByIdController);

export default router;
