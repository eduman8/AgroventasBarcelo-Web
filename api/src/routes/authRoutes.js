import { Router } from 'express';
import { loginController } from '../controllers/authController.js';

const router = Router();

router.post('/auth/login', loginController);

export default router;
