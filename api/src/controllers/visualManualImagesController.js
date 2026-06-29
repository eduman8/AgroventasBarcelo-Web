import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateManualImagesFromPdf } from '../services/visualManualImagesService.js';

const maxPdfBytes = Number.parseInt(process.env.MANUALES_VISUALES_MAX_PDF_BYTES || String(30 * 1024 * 1024), 10);

const parseMultipart = (buffer, contentType) => {
  const boundary = contentType.match(/boundary=(?:(?:"([^"]+)")|([^;]+))/i)?.[1] || contentType.match(/boundary=(?:(?:"([^"]+)")|([^;]+))/i)?.[2];
  if (!boundary) throw new Error('Formulario multipart inválido.');
  const delimiter = Buffer.from(`--${boundary}`);
  const fields = {};
  let file = null;
  let start = buffer.indexOf(delimiter);
  while (start !== -1) {
    const next = buffer.indexOf(delimiter, start + delimiter.length);
    if (next === -1) break;
    let part = buffer.subarray(start + delimiter.length, next);
    if (part.subarray(0, 2).toString() === '\r\n') part = part.subarray(2);
    if (part.subarray(part.length - 2).toString() === '\r\n') part = part.subarray(0, -2);
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd > -1) {
      const headers = part.subarray(0, headerEnd).toString('utf8');
      const body = part.subarray(headerEnd + 4);
      const name = headers.match(/name="([^"]+)"/i)?.[1];
      const filename = headers.match(/filename="([^"]*)"/i)?.[1];
      const mimetype = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || '';
      if (filename) file = { fieldname: name, originalname: filename, mimetype, buffer: body, size: body.length };
      else if (name) fields[name] = body.toString('utf8').trim();
    }
    start = next;
  }
  return { fields, file };
};

export const parseVisualManualUpload = async (request, response, next) => {
  try {
    const contentType = request.headers['content-type'] || '';
    if (!contentType.toLowerCase().startsWith('multipart/form-data')) throw new Error('La carga debe enviarse como multipart/form-data.');
    const chunks = [];
    let total = 0;
    for await (const chunk of request) {
      total += chunk.length;
      if (total > maxPdfBytes + 1024 * 1024) throw new Error(`El PDF supera el máximo permitido de ${Math.round(maxPdfBytes / 1024 / 1024)} MB.`);
      chunks.push(chunk);
    }
    const { fields, file } = parseMultipart(Buffer.concat(chunks), contentType);
    if (!file || file.fieldname !== 'archivo') throw new Error('Adjuntá un archivo PDF.');
    if (file.mimetype && file.mimetype !== 'application/pdf') throw new Error('Solo se permiten archivos PDF.');
    if (!file.originalname.toLowerCase().endsWith('.pdf')) throw new Error('Solo se permiten archivos PDF.');
    const tempDir = path.join(os.tmpdir(), 'agrobarcelo-manuales-visuales');
    await fs.mkdir(tempDir, { recursive: true });
    const filePath = path.join(tempDir, `${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
    await fs.writeFile(filePath, file.buffer);
    request.body = fields;
    request.file = { path: filePath, originalname: file.originalname, mimetype: file.mimetype, size: file.size };
    next();
  } catch (error) {
    response.status(400).json({ status: 'error', message: error.message || 'No se pudo subir el PDF.' });
  }
};

export const uploadVisualManualController = async (request, response) => {
  try {
    const result = await generateManualImagesFromPdf({ manualNombre: request.body?.manualNombre, file: request.file });
    response.status(201).json({ status: 'ok', ...result });
  } catch (error) {
    console.error('[visual-manual-images-upload]', error);
    response.status(400).json({ status: 'error', message: error.message || 'No se pudo generar imágenes desde el PDF.' });
  }
};
