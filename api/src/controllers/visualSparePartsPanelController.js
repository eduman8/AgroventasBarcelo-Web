import { applyVisualDataPageOffset, createVisualPoint, deleteVisualPoint, getVisualDataPageConfig, getVisualSparePartsPanel, saveVisualDataPageConfig, searchManualSparePartsForVisualPage, updateVisualPoint } from '../services/visualSparePartsPanelService.js';

const handleError = (response, error, message, status = 500) => {
  console.error('[visual-spare-parts-panel]', error);
  response.status(error.statusCode || status).json({ status: 'error', message, duplicatePoint: error.duplicatePoint });
};

export const getVisualSparePartsPanelController = async (request, response) => {
  try {
    response.json(await getVisualSparePartsPanel({ manualNombre: request.query.manualNombre || request.query.manual, pagina: request.query.pagina }));
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


export const getAdminVisualDataPageConfigController = async (request, response) => {
  try { response.json(await getVisualDataPageConfig({ manualNombre: request.query.manualNombre, pagina: request.query.paginaVisual || request.query.pagina })); }
  catch (error) { handleError(response, error, 'No se pudo cargar la configuración de página de datos.'); }
};

export const saveAdminVisualDataPageConfigController = async (request, response) => {
  try { response.json(await saveVisualDataPageConfig(request.body)); }
  catch (error) { handleError(response, error, error.message || 'No se pudo guardar la configuración de página de datos.', 400); }
};

export const applyAdminVisualDataPageOffsetController = async (request, response) => {
  try { response.json(await applyVisualDataPageOffset(request.body)); }
  catch (error) { handleError(response, error, error.message || 'No se pudo aplicar la configuración masiva.', 400); }
};

export const searchAdminVisualManualSparePartsController = async (request, response) => {
  try {
    response.json({ data: await searchManualSparePartsForVisualPage({ manualNombre: request.query.manualNombre, paginaDatos: request.query.paginaDatos, search: request.query.search }) });
  } catch (error) { handleError(response, error, 'No se pudieron buscar repuestos manuales para vincular.'); }
};


export const getPublicManualPointsController = async (request, response) => {
  try {
    const panel = await getVisualSparePartsPanel({ manualNombre: request.query.manual || request.query.manualNombre, pagina: request.query.pagina });
    response.json({
      data: (panel.puntos || []).map((point) => ({
        id: point.id,
        referencia: point.referenciaDespiece,
        codigo: point.codigo || '',
        descripcion: point.descripcion || '',
        xPercent: point.xPercent,
        yPercent: point.yPercent
      }))
    });
  } catch (error) { handleError(response, error, 'No se pudieron cargar los puntos públicos del manual.'); }
};
