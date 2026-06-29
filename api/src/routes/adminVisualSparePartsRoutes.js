import { Router } from 'express';
import { createAdminVisualPointController, deleteAdminVisualPointController, getAdminVisualPointsController, updateAdminVisualPointController } from '../controllers/visualSparePartsPanelController.js';

const router = Router();
router.get('/repuestos-visuales/puntos', getAdminVisualPointsController);
router.post('/repuestos-visuales/puntos', createAdminVisualPointController);
router.put('/repuestos-visuales/puntos/:id', updateAdminVisualPointController);
router.delete('/repuestos-visuales/puntos/:id', deleteAdminVisualPointController);
export default router;
