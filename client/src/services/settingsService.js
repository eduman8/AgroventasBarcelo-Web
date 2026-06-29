import { getJsonHeaders } from './apiClient.js';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const isDevelopmentMode = import.meta.env.DEV;

export const defaultSettings = {
  emailContacto: 'info@agrobarcelo.com.ar',
  whatsapp: '5493471345613',
  instagram: 'https://www.instagram.com/agrobarcelo/',
  ubicacion: 'San Luis 759, Armstrong, Santa Fe',
  textoFooter: 'Acompañamos al productor con soluciones confiables, repuestos agrícolas, maquinarias, postventa y mecanizado CNC para el trabajo de cada día.'
};

async function parseError(response, fallback) {
  try { return (await response.json())?.message || fallback; } catch { return fallback; }
}

async function fetchSettings(path, options, fallback) {
  const response = await fetch(`${apiUrl}${path}`, { ...options, headers: getJsonHeaders(options?.headers) });
  if (!response.ok) throw new Error(await parseError(response, fallback));
  return response.json();
}

export async function getSettings() {
  try { return await fetchSettings('/api/configuracion', {}, 'No se pudo cargar la configuración.'); }
  catch (error) {
    if (isDevelopmentMode) return defaultSettings;
    throw error;
  }
}

export async function updateSettings(data) {
  return fetchSettings('/api/admin/configuracion', { method: 'PUT', body: JSON.stringify(data) }, 'No se pudo guardar la configuración.');
}
