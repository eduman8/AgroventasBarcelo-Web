import { Router } from 'express';
import { uploadMachineImageController } from '../controllers/machineImagesController.js';

const router = Router();

router.post('/admin/maquinarias/imagenes', uploadMachineImageController);

export default router;
