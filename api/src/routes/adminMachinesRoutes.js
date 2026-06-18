import { Router } from 'express';
import {
  createAdminMachineController,
  deleteAdminMachineController,
  getAdminMachinesController,
  updateAdminMachineController
} from '../controllers/adminMachinesController.js';

const router = Router();

router.get('/admin/maquinarias', getAdminMachinesController);
router.post('/admin/maquinarias', createAdminMachineController);
router.put('/admin/maquinarias/:id', updateAdminMachineController);
router.delete('/admin/maquinarias/:id', deleteAdminMachineController);

export default router;
