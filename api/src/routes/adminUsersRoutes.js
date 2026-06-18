import { Router } from 'express';
import {
  getAdminUserDetailController,
  getAdminUsersController,
  updateAdminUserStatusController
} from '../controllers/adminUsersController.js';

const router = Router();

router.get('/admin/usuarios', getAdminUsersController);
router.get('/admin/usuarios/:id', getAdminUserDetailController);
router.patch('/admin/usuarios/:id/estado', updateAdminUserStatusController);

export default router;
