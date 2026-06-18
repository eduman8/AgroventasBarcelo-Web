import { Router } from 'express';
import { getDbHealth } from '../controllers/dbHealthController.js';

const router = Router();

router.get('/db/health', getDbHealth);

export default router;
