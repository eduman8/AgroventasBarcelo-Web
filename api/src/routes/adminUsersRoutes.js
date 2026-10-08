import { Router } from 'express';
import {
  getAdminUserDetailController,
  getAdminUsersController,
  updateAdminUserRoleController,
  updateAdminUserStatusController
} from '../controllers/adminUsersController.js';

const router = Router();

router.get('/admin/usuarios', getAdminUsersController);
router.get('/admin/usuarios/:id', getAdminUserDetailController);
router.patch('/admin/usuarios/:id/estado', updateAdminUserStatusController);
router.patch('/admin/usuarios/:id/rol', updateAdminUserRoleController);

export default router;
