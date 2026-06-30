import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSqlPool, sql } from '../config/sqlServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');
const manualsPublicDir = path.join(publicDir, 'manuales-visuales');
const uploadsDir = path.resolve(__dirname, '../uploads/manuales-visuales');
const maxPdfBytes = Number.parseInt(process.env.MANUALES_VISUALES_MAX_PDF_BYTES || String(30 * 1024 * 1024), 10);

export const normalizeManualName = (value) => String(value ?? '').trim().slice(0, 200);
export const slugifyManualName = (value) => normalizeManualName(value)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 120);

export const ensureVisualManualImagesTable = async (pool) => {
  await pool.request().query(`
IF NOT EXISTS (SELECT 1 FROM sys.tables t INNER JOIN sys.schemas s ON s.schema_id = t.schema_id WHERE t.name = N'RepuestosManualesImagenes' AND s.name = N'dbo')
BEGIN
  CREATE TABLE dbo.RepuestosManualesImagenes (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ManualNombre NVARCHAR(200) NOT NULL,
    ManualSlug NVARCHAR(150) NOT NULL,
    Pagina INT NOT NULL,
    ImageUrl NVARCHAR(500) NOT NULL,
    ArchivoOrigen NVARCHAR(500) NULL,
    Activo BIT NOT NULL CONSTRAINT DF_RepuestosManualesImagenes_Activo DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_RepuestosManualesImagenes_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL
  );
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_RepuestosManualesImagenes_ManualPagina' AND object_id = OBJECT_ID(N'dbo.RepuestosManualesImagenes'))
BEGIN
  CREATE UNIQUE INDEX UX_RepuestosManualesImagenes_ManualPagina ON dbo.RepuestosManualesImagenes (ManualSlug, Pagina);
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_RepuestosManualesImagenes_Busqueda' AND object_id = OBJECT_ID(N'dbo.RepuestosManualesImagenes'))
BEGIN
  CREATE INDEX IX_RepuestosManualesImagenes_Busqueda ON dbo.RepuestosManualesImagenes (Activo, ManualNombre, Pagina) INCLUDE (ImageUrl, ManualSlug);
END;
`);
};

export const getManualImageUrl = async (pool, { manualNombre, pagina }) => {
  await ensureVisualManualImagesTable(pool);
  const manual = normalizeManualName(manualNombre);
  const page = Number.parseInt(pagina, 10);
  if (!manual || !Number.isInteger(page) || page < 1) return null;
  const result = await pool.request()
    .input('manualNombre', sql.NVarChar(200), manual)
    .input('manualSlug', sql.NVarChar(150), slugifyManualName(manual))
    .input('pagina', sql.Int, page)
    .query(`
SELECT TOP (1) ImageUrl AS imageUrl
FROM dbo.RepuestosManualesImagenes
WHERE Activo = 1 AND Pagina = @pagina AND (ManualNombre = @manualNombre OR ManualSlug = @manualSlug)
ORDER BY UpdatedAt DESC, CreatedAt DESC;`);
  return result.recordset?.[0]?.imageUrl ?? null;
};


export const getManualImagesTotalPages = async (pool, { manualNombre }) => {
  await ensureVisualManualImagesTable(pool);
  const manual = normalizeManualName(manualNombre);
  if (!manual) return null;
  const result = await pool.request()
    .input('manualNombre', sql.NVarChar(200), manual)
    .input('manualSlug', sql.NVarChar(150), slugifyManualName(manual))
    .query(`
SELECT MAX(Pagina) AS totalPages
FROM dbo.RepuestosManualesImagenes
WHERE Activo = 1 AND (ManualNombre = @manualNombre OR ManualSlug = @manualSlug);`);
  const totalPages = Number.parseInt(result.recordset?.[0]?.totalPages, 10);
  return Number.isInteger(totalPages) && totalPages > 0 ? totalPages : null;
};

const assertPdf = async (filePath, mimetype, size) => {
  if (size > maxPdfBytes) throw new Error(`El PDF supera el máximo permitido de ${Math.round(maxPdfBytes / 1024 / 1024)} MB.`);
  if (mimetype && mimetype !== 'application/pdf') throw new Error('El archivo debe ser un PDF.');
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(5);
    await handle.read(buffer, 0, 5, 0);
    if (buffer.toString('utf8') !== '%PDF-') throw new Error('El archivo no parece ser un PDF válido.');
  } finally {
    await handle.close();
  }
};

const getPdfRenderScale = () => {
  const dpi = Number.parseInt(process.env.MANUALES_VISUALES_PDF_DPI || '144', 10);
  return Number.isFinite(dpi) && dpi > 0 ? dpi / 72 : 2;
};

const renderPdfPagesToPng = async ({ pdfPath, outputDir }) => {
  const [{ getDocument, GlobalWorkerOptions }, { createCanvas }] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('@napi-rs/canvas')
  ]);

  GlobalWorkerOptions.workerSrc ||= null;

  const data = new Uint8Array(await fs.readFile(pdfPath));
  const document = await getDocument({ data, disableWorker: true }).promise;
  const scale = getPdfRenderScale();
  const pages = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const canvasContext = canvas.getContext('2d');

      await page.render({ canvasContext, viewport }).promise;

      const file = `pagina-${pageNumber}.png`;
      await fs.writeFile(path.join(outputDir, file), canvas.toBuffer('image/png'));
      pages.push({ file, page: pageNumber });
      page.cleanup();
    }
  } finally {
    await document.destroy();
  }

  return pages;
};

export const generateManualImagesFromPdf = async ({ manualNombre, file }) => {
  const manual = normalizeManualName(manualNombre);
  const manualSlug = slugifyManualName(manual);
  if (!manual || !manualSlug) throw new Error('Ingresá un nombre de manual válido.');
  if (!file?.path) throw new Error('Adjuntá un archivo PDF.');

  await assertPdf(file.path, file.mimetype, file.size);
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.mkdir(manualsPublicDir, { recursive: true });

  const manualDir = path.join(manualsPublicDir, manualSlug);
  const tempDir = path.join(manualsPublicDir, `${manualSlug}.__tmp__${Date.now()}`);
  const pdfTarget = path.join(uploadsDir, `${manualSlug}-${Date.now()}.pdf`);
  await fs.mkdir(manualDir, { recursive: true });
  await fs.mkdir(tempDir, { recursive: true });
  await fs.copyFile(file.path, pdfTarget);

  try {
    const generated = await renderPdfPagesToPng({ pdfPath: file.path, outputDir: tempDir });
    if (!generated.length) throw new Error('No se generaron imágenes desde el PDF.');

    const pool = await getSqlPool();
    await ensureVisualManualImagesTable(pool);
    const pages = [];

    for (const item of generated) {
      const finalName = `pagina-${item.page}.png`;
      const finalPath = path.join(manualDir, finalName);
      await fs.rename(path.join(tempDir, item.file), finalPath);
      const imageUrl = `/manuales-visuales/${manualSlug}/${finalName}`;
      await pool.request()
        .input('manualNombre', sql.NVarChar(200), manual)
        .input('manualSlug', sql.NVarChar(150), manualSlug)
        .input('pagina', sql.Int, item.page)
        .input('imageUrl', sql.NVarChar(500), imageUrl)
        .input('archivoOrigen', sql.NVarChar(500), path.basename(pdfTarget))
        .query(`
MERGE dbo.RepuestosManualesImagenes AS target
USING (SELECT @manualSlug AS ManualSlug, @pagina AS Pagina) AS source
ON target.ManualSlug = source.ManualSlug AND target.Pagina = source.Pagina
WHEN MATCHED THEN UPDATE SET ManualNombre=@manualNombre, ImageUrl=@imageUrl, ArchivoOrigen=@archivoOrigen, Activo=1, UpdatedAt=SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT (ManualNombre, ManualSlug, Pagina, ImageUrl, ArchivoOrigen, Activo) VALUES (@manualNombre, @manualSlug, @pagina, @imageUrl, @archivoOrigen, 1);`);
      pages.push({ pagina: item.page, imageUrl });
    }

    return { manualNombre: manual, manualSlug, paginasGeneradas: pages.length, paginas: pages };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.rm(file.path, { force: true });
  }
};
