import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export class MachineImageValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MachineImageValidationError';
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'maquinarias');
const publicBasePath = '/uploads/maquinarias';
const maxImageSizeBytes = Number.parseInt(process.env.MACHINE_IMAGE_MAX_BYTES ?? '', 10) || 5 * 1024 * 1024;
const allowedMimeTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif']
]);

function parseDataUrl(value) {
  const match = /^data:([^;]+);base64,(.+)$/u.exec(String(value ?? ''));

  if (!match) {
    throw new MachineImageValidationError('La imagen debe enviarse en formato data URL base64.');
  }

  return { mimeType: match[1].toLowerCase(), base64Data: match[2] };
}

export async function saveMachineImageFromDataUrl(dataUrl) {
  const { mimeType, base64Data } = parseDataUrl(dataUrl);
  const extension = allowedMimeTypes.get(mimeType);

  if (!extension) {
    throw new MachineImageValidationError('El archivo debe ser una imagen JPG, PNG, WEBP o GIF.');
  }

  const buffer = Buffer.from(base64Data, 'base64');

  if (!buffer.length) {
    throw new MachineImageValidationError('La imagen está vacía.');
  }

  if (buffer.length > maxImageSizeBytes) {
    throw new MachineImageValidationError(`La imagen no puede superar ${Math.round(maxImageSizeBytes / 1024 / 1024)} MB.`);
  }

  await fs.mkdir(uploadsDir, { recursive: true });

  const filename = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  await fs.writeFile(path.join(uploadsDir, filename), buffer, { flag: 'wx' });

  return `${publicBasePath}/${filename}`;
}
