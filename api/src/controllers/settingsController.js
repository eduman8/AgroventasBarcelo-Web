import { getSettings, updateSettings } from '../services/settingsService.js';

const handle = (res, error) => {
  console.error('[settings] SQL Server query error', error?.cause || error);
  res.status(500).json({ status: 'error', message: 'No se pudo procesar la configuración.' });
};

export const getSettingsController = async (req, res) => {
  try { res.json(await getSettings()); } catch (error) { handle(res, error); }
};

export const updateSettingsController = async (req, res) => {
  try { res.json(await updateSettings(req.body)); } catch (error) { handle(res, error); }
};
