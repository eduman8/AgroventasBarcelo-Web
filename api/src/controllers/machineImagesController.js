import { MachineImageValidationError, saveMachineImageFromDataUrl } from '../services/machineImagesService.js';

export const uploadMachineImageController = async (request, response) => {
  try {
    const url = await saveMachineImageFromDataUrl(request.body?.dataUrl);

    response.status(201).json({ url });
  } catch (error) {
    if (error instanceof MachineImageValidationError) {
      response.status(400).json({ status: 'error', message: error.message });
      return;
    }

    console.error('[machine-image-upload] error', error);
    response.status(500).json({ status: 'error', message: 'No se pudo guardar la imagen.' });
  }
};
