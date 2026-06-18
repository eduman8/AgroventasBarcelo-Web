import { Router } from 'express';
import { getSettingsController, updateSettingsController } from '../controllers/settingsController.js';

const router = Router();
router.get('/configuracion', getSettingsController);
router.put('/admin/configuracion', updateSettingsController);
export default router;
