import { createVisualPoint, deleteVisualPoint, getVisualSparePartsPanel, updateVisualPoint } from '../services/visualSparePartsPanelService.js';

const handleError = (response, error, message, status = 500) => {
  console.error('[visual-spare-parts-panel]', error);
  response.status(status).json({ status: 'error', message });
};

export const getVisualSparePartsPanelController = async (request, response) => {
  try {
    response.json(await getVisualSparePartsPanel({ manualNombre: request.query.manualNombre, pagina: request.query.pagina }));
  } catch (error) { handleError(response, error, 'No se pudo cargar el panel visual de repuestos.'); }
};

export const getAdminVisualPointsController = async (request, response) => getVisualSparePartsPanelController(request, response);

export const createAdminVisualPointController = async (request, response) => {
  try { response.status(201).json(await createVisualPoint(request.body)); }
  catch (error) { handleError(response, error, error.message || 'No se pudo crear el punto visual.', 400); }
};

export const updateAdminVisualPointController = async (request, response) => {
  try {
    const point = await updateVisualPoint(request.params.id, request.body);
    if (!point) return response.status(404).json({ status: 'error', message: 'Punto visual no encontrado.' });
    return response.json(point);
  } catch (error) { return handleError(response, error, error.message || 'No se pudo actualizar el punto visual.', 400); }
};

export const deleteAdminVisualPointController = async (request, response) => {
  try {
    const deleted = await deleteVisualPoint(request.params.id);
    if (!deleted) return response.status(404).json({ status: 'error', message: 'Punto visual no encontrado.' });
    return response.status(204).send();
  } catch (error) { return handleError(response, error, 'No se pudo eliminar el punto visual.'); }
};
