import { Router } from 'express';
import { createContactRequest } from '../controllers/contactController.js';

const router = Router();

router.post('/contact', createContactRequest);

export default router;
