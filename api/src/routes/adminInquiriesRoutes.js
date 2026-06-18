import { Router } from 'express';
import {
  getAdminInquiriesController,
  getAdminInquiryDetailController,
  updateAdminInquiryStatusController
} from '../controllers/adminInquiriesController.js';

const router = Router();

router.get('/admin/consultas', getAdminInquiriesController);
router.get('/admin/consultas/:id', getAdminInquiryDetailController);
router.patch('/admin/consultas/:id/estado', updateAdminInquiryStatusController);

export default router;
