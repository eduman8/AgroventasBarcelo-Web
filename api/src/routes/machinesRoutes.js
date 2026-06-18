import { Router } from 'express';
import { getMachineBySlugController, getMachinesController } from '../controllers/machinesController.js';

const router = Router();

router.get('/maquinarias', getMachinesController);
router.get('/maquinarias/:slug', getMachineBySlugController);

export default router;
