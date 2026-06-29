import { Router } from 'express';
import { getDbHealth } from '../controllers/dbHealthController.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireActiveUser, requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.get('/db/health', requireAuth, requireActiveUser, requireAdmin, getDbHealth);

export default router;
