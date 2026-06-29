import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSqlPool, sql } from '../config/sqlServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');
const visualImagesDir = path.join(publicDir, 'manuales-visuales');
const sparePartRubrosFilter = 'p.ID_Rubro IN (3, 4, 8, 11, 13, 24, 26, 27)';

const normalizeManualName = (value) => String(value ?? '').trim().slice(0, 200);
const normalizeReference = (value) => String(value ?? '').trim().slice(0, 150);
const normalizePage = (value) => {
  const page = Number.parseInt(value, 10);
  return Number.isInteger(page) && page > 0 ? page : null;
};
const normalizePercent = (value) => {
  const percent = Number.parseFloat(value);
  if (!Number.isFinite(percent)) return null;
  return Math.min(Math.max(percent, 0), 100);
};
const getDisplayValue = (value, fallback = '') => (value === null || value === undefined || value === '' ? fallback : value);
const slugify = (value) => normalizeManualName(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const resolveImageUrl = (manualNombre, pagina) => {
  const manualSlug = slugify(manualNombre);
  if (!manualSlug || !pagina) return null;
  const candidates = ['jpg', 'jpeg', 'png', 'webp'].map((extension) => `${manualSlug}-pagina-${pagina}.${extension}`);
  const match = candidates.find((fileName) => fs.existsSync(path.join(visualImagesDir, fileName)));
  return match ? `/manuales-visuales/${match}` : null;
};

export const ensureVisualPointsTable = async (pool) => {
  await pool.request().query(`
IF NOT EXISTS (SELECT 1 FROM sys.tables t INNER JOIN sys.schemas s ON s.schema_id = t.schema_id WHERE t.name = N'RepuestosManualesPuntosVisuales' AND s.name = N'dbo')
BEGIN
  CREATE TABLE dbo.RepuestosManualesPuntosVisuales (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ManualNombre NVARCHAR(200) NOT NULL,
    Pagina INT NOT NULL,
    ReferenciaDespiece NVARCHAR(150) NOT NULL,
    XPercent DECIMAL(6,3) NOT NULL,
    YPercent DECIMAL(6,3) NOT NULL,
    Activo BIT NOT NULL CONSTRAINT DF_RepuestosManualesPuntosVisuales_Activo DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_RepuestosManualesPuntosVisuales_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL
  );
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_RepuestosManualesPuntosVisuales_ManualPagina' AND object_id = OBJECT_ID(N'dbo.RepuestosManualesPuntosVisuales'))
BEGIN
  CREATE INDEX IX_RepuestosManualesPuntosVisuales_ManualPagina ON dbo.RepuestosManualesPuntosVisuales (Activo, ManualNombre, Pagina, ReferenciaDespiece);
END;
`);
};

const panelQuery = `
SELECT pv.Id AS id, pv.ManualNombre AS manualNombre, pv.Pagina AS pagina, pv.ReferenciaDespiece AS referenciaDespiece,
  CAST(pv.XPercent AS FLOAT) AS xPercent, CAST(pv.YPercent AS FLOAT) AS yPercent, pv.Activo AS activo,
  rm.Codigo AS codigo, rm.Descripcion AS descripcion, rm.Categoria AS categoria, rm.Marca AS marca, rm.ModeloMaquina AS modelo,
  catalogo.ID_Articulo AS repuestoCatalogoId
FROM dbo.RepuestosManualesPuntosVisuales pv
OUTER APPLY (
  SELECT TOP (1) * FROM dbo.RepuestosManuales rm
  WHERE rm.Activo = 1 AND rm.ManualNombre = pv.ManualNombre AND rm.Pagina = pv.Pagina
    AND UPPER(LTRIM(RTRIM(COALESCE(rm.ReferenciaDespiece, '')))) = UPPER(LTRIM(RTRIM(pv.ReferenciaDespiece)))
  ORDER BY rm.Codigo
) rm
OUTER APPLY (
  SELECT TOP (1) p.ID_Articulo FROM dbo.Productos p
  WHERE ${sparePartRubrosFilter} AND NULLIF(LTRIM(RTRIM(rm.Codigo)), '') IS NOT NULL
    AND UPPER(LTRIM(RTRIM(p.CodigoAlternativo))) = UPPER(LTRIM(RTRIM(rm.Codigo)))
  ORDER BY p.Descripcion, p.ID_Articulo
) catalogo
WHERE pv.Activo = 1 AND pv.ManualNombre = @manualNombre AND pv.Pagina = @pagina
ORDER BY pv.ReferenciaDespiece, pv.Id;`;

const mapPoint = (point) => ({
  id: point.id,
  referenciaDespiece: getDisplayValue(point.referenciaDespiece),
  xPercent: point.xPercent,
  yPercent: point.yPercent,
  codigo: getDisplayValue(point.codigo, 'Sin código'),
  descripcion: getDisplayValue(point.descripcion, 'Sin descripción'),
  categoria: getDisplayValue(point.categoria),
  marca: getDisplayValue(point.marca),
  modelo: getDisplayValue(point.modelo),
  disponibleEnCatalogo: Boolean(point.repuestoCatalogoId),
  repuestoCatalogoId: point.repuestoCatalogoId ?? null,
  manualNombre: point.manualNombre,
  pagina: point.pagina
});

export const getVisualSparePartsPanel = async ({ manualNombre, pagina }) => {
  const pool = await getSqlPool();
  await ensureVisualPointsTable(pool);
  const manual = normalizeManualName(manualNombre);
  const page = normalizePage(pagina);
  if (!manual || !page) return { manualNombre: manual, pagina: page, imageUrl: null, puntos: [] };
  const result = await pool.request().input('manualNombre', sql.NVarChar(200), manual).input('pagina', sql.Int, page).query(panelQuery);
  return { manualNombre: manual, pagina: page, imageUrl: resolveImageUrl(manual, page), puntos: (result.recordset ?? []).map(mapPoint) };
};

export const createVisualPoint = async ({ manualNombre, pagina, referenciaDespiece, xPercent, yPercent, activo = true }) => {
  const pool = await getSqlPool(); await ensureVisualPointsTable(pool);
  const manual = normalizeManualName(manualNombre); const page = normalizePage(pagina); const reference = normalizeReference(referenciaDespiece);
  const x = normalizePercent(xPercent); const y = normalizePercent(yPercent);
  if (!manual || !page || !reference || x === null || y === null) throw new Error('Datos inválidos para crear el punto visual.');
  const result = await pool.request().input('manualNombre', sql.NVarChar(200), manual).input('pagina', sql.Int, page).input('referenciaDespiece', sql.NVarChar(150), reference).input('xPercent', sql.Decimal(6,3), x).input('yPercent', sql.Decimal(6,3), y).input('activo', sql.Bit, Boolean(activo)).query(`
INSERT INTO dbo.RepuestosManualesPuntosVisuales (ManualNombre, Pagina, ReferenciaDespiece, XPercent, YPercent, Activo)
OUTPUT INSERTED.Id AS id, INSERTED.ManualNombre AS manualNombre, INSERTED.Pagina AS pagina, INSERTED.ReferenciaDespiece AS referenciaDespiece, CAST(INSERTED.XPercent AS FLOAT) AS xPercent, CAST(INSERTED.YPercent AS FLOAT) AS yPercent, INSERTED.Activo AS activo
VALUES (@manualNombre, @pagina, @referenciaDespiece, @xPercent, @yPercent, @activo);`);
  return result.recordset?.[0];
};

export const updateVisualPoint = async (id, data) => {
  const pool = await getSqlPool(); await ensureVisualPointsTable(pool);
  const pointId = Number.parseInt(id, 10); const manual = normalizeManualName(data.manualNombre); const page = normalizePage(data.pagina); const reference = normalizeReference(data.referenciaDespiece); const x = normalizePercent(data.xPercent); const y = normalizePercent(data.yPercent);
  if (!pointId || !manual || !page || !reference || x === null || y === null) throw new Error('Datos inválidos para actualizar el punto visual.');
  const result = await pool.request().input('id', sql.Int, pointId).input('manualNombre', sql.NVarChar(200), manual).input('pagina', sql.Int, page).input('referenciaDespiece', sql.NVarChar(150), reference).input('xPercent', sql.Decimal(6,3), x).input('yPercent', sql.Decimal(6,3), y).input('activo', sql.Bit, data.activo !== false).query(`
UPDATE dbo.RepuestosManualesPuntosVisuales SET ManualNombre=@manualNombre, Pagina=@pagina, ReferenciaDespiece=@referenciaDespiece, XPercent=@xPercent, YPercent=@yPercent, Activo=@activo, UpdatedAt=SYSUTCDATETIME()
OUTPUT INSERTED.Id AS id, INSERTED.ManualNombre AS manualNombre, INSERTED.Pagina AS pagina, INSERTED.ReferenciaDespiece AS referenciaDespiece, CAST(INSERTED.XPercent AS FLOAT) AS xPercent, CAST(INSERTED.YPercent AS FLOAT) AS yPercent, INSERTED.Activo AS activo
WHERE Id=@id;`);
  return result.recordset?.[0] ?? null;
};

export const deleteVisualPoint = async (id) => {
  const pool = await getSqlPool(); await ensureVisualPointsTable(pool);
  const pointId = Number.parseInt(id, 10); if (!pointId) return false;
  const result = await pool.request().input('id', sql.Int, pointId).query('UPDATE dbo.RepuestosManualesPuntosVisuales SET Activo = 0, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id;');
  return result.rowsAffected?.[0] > 0;
};
