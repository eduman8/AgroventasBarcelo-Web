import { Router } from 'express';
import { applyAdminVisualDataPageOffsetController, createAdminVisualPointController, deleteAdminVisualPointController, getAdminVisualDataPageConfigController, getAdminVisualPointsController, saveAdminVisualDataPageConfigController, searchAdminVisualManualSparePartsController, updateAdminVisualPointController } from '../controllers/visualSparePartsPanelController.js';
import { parseVisualManualUpload, uploadVisualManualController } from '../controllers/visualManualImagesController.js';

const router = Router();
router.post('/repuestos-visuales/manuales/upload', parseVisualManualUpload, uploadVisualManualController);
router.get('/repuestos-visuales/puntos', getAdminVisualPointsController);
router.get('/manual-puntos', getAdminVisualPointsController);
router.get('/repuestos-visuales/repuestos-manuales', searchAdminVisualManualSparePartsController);
router.get('/repuestos-visuales/paginas-datos', getAdminVisualDataPageConfigController);
router.put('/repuestos-visuales/paginas-datos', saveAdminVisualDataPageConfigController);
router.post('/repuestos-visuales/paginas-datos/offset', applyAdminVisualDataPageOffsetController);
router.post('/repuestos-visuales/puntos', createAdminVisualPointController);
router.post('/manual-puntos', createAdminVisualPointController);
router.put('/repuestos-visuales/puntos/:id', updateAdminVisualPointController);
router.put('/manual-puntos/:id', updateAdminVisualPointController);
router.delete('/repuestos-visuales/puntos/:id', deleteAdminVisualPointController);
router.delete('/manual-puntos/:id', deleteAdminVisualPointController);
export default router;
