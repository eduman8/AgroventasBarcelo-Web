import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSqlPool, sql } from '../config/sqlServer.js';
import { ensureVisualManualImagesTable, getManualImageUrl, slugifyManualName } from './visualManualImagesService.js';

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
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null;
  return percent;
};
const getDisplayValue = (value, fallback = '') => (value === null || value === undefined || value === '' ? fallback : value);

const buildNormalizedReferenceExpression = (valueExpression) => {
  const trimmed = `UPPER(LTRIM(RTRIM(CONVERT(NVARCHAR(150), COALESCE(${valueExpression}, '')))))`;
  const withoutPrefixes = [
    ['NCHAR(186)', "''"],
    ['NCHAR(176)', "''"],
    ["'ELEMENTO'", "''"],
    ["'ELEM.'", "''"],
    ["'ELEM'", "''"],
    ["'ITEM'", "''"],
    ["'NRO.'", "''"],
    ["'NRO'", "''"],
    ["'NUMERO'", "''"],
    ["'NÚMERO'", "''"],
    ["'NO.'", "''"],
    ["'NO'", "''"],
    ["'N.'", "''"],
    ["'N'", "''"],
    ["'#'", "''"],
    ["':'", "''"],
    ["'.'", "''"],
    ["'-'", "''"],
    ["'_'", "''"],
    ["'/'", "''"],
    ["' '", "''"],
    ['CHAR(9)', "''"]
  ].reduce((expression, [search, replacement]) => `REPLACE(${expression}, ${search}, ${replacement})`, trimmed);

  return `COALESCE(CONVERT(NVARCHAR(150), TRY_CONVERT(BIGINT, NULLIF(${withoutPrefixes}, ''))), NULLIF(${withoutPrefixes}, ''))`;
};
const slugify = slugifyManualName;

const resolveImageUrl = (manualNombre, pagina) => {
  const manualSlug = slugify(manualNombre);
  if (!manualSlug || !pagina) return null;
  const candidates = ['jpg', 'jpeg', 'png', 'webp'].map((extension) => `${manualSlug}-pagina-${pagina}.${extension}`);
  const match = candidates.find((fileName) => fs.existsSync(path.join(visualImagesDir, fileName)));
  return match ? `/manuales-visuales/${match}` : null;
};

export const ensureVisualPointsTable = async (pool) => {
  await ensureVisualManualImagesTable(pool);
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

const getManualSparePartsPanelSchema = async (pool) => {
  const result = await pool.request().query(`
    SELECT COLUMN_NAME AS columnName
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = N'dbo'
      AND TABLE_NAME = N'RepuestosManuales';
  `);
  const columnNames = new Set((result.recordset ?? []).map((column) => column.columnName));
  const pickColumn = (candidates) => candidates.find((candidate) => columnNames.has(candidate)) ?? null;

  return {
    modelColumn: pickColumn(['Modelo', 'ModeloMaquina'])
  };
};

const buildPanelQuery = ({ modelColumn }) => {
  const modelSelect = modelColumn ? `matched.${modelColumn}` : 'NULL';
  const directManualReferenceNormalized = buildNormalizedReferenceExpression('rm.ReferenciaDespiece');
  const inferredReferenceNormalized = buildNormalizedReferenceExpression('CONVERT(NVARCHAR(150), ordered.inferredReferenciaDespiece)');
  const pointReferenceNormalized = buildNormalizedReferenceExpression('pv.ReferenciaDespiece');

  return `
SELECT pv.Id AS id, pv.ManualNombre AS manualNombre, pv.Pagina AS pagina, pv.ReferenciaDespiece AS referenciaDespiece,
  CAST(pv.XPercent AS FLOAT) AS xPercent, CAST(pv.YPercent AS FLOAT) AS yPercent, pv.Activo AS activo,
  matched.Codigo AS codigo, matched.Descripcion AS descripcion, matched.Categoria AS categoria, matched.Marca AS marca, ${modelSelect} AS modelo,
  CASE WHEN directMatch.Id IS NOT NULL THEN 'direct' WHEN inferredMatch.Id IS NOT NULL THEN 'inferredByPageOrder' ELSE 'none' END AS matchSource,
  catalogo.ID_Articulo AS repuestoCatalogoId
FROM dbo.RepuestosManualesPuntosVisuales pv
OUTER APPLY (
  SELECT TOP (1) rm.* FROM dbo.RepuestosManuales rm
  WHERE rm.Activo = 1 AND LTRIM(RTRIM(rm.ManualNombre)) = LTRIM(RTRIM(pv.ManualNombre)) AND rm.Pagina = pv.Pagina
    AND ${directManualReferenceNormalized} = ${pointReferenceNormalized}
    AND (NULLIF(LTRIM(RTRIM(rm.Codigo)), '') IS NOT NULL OR NULLIF(LTRIM(RTRIM(rm.Descripcion)), '') IS NOT NULL)
  ORDER BY
    CASE WHEN UPPER(LTRIM(RTRIM(COALESCE(rm.ReferenciaDespiece, '')))) = UPPER(LTRIM(RTRIM(pv.ReferenciaDespiece))) THEN 0 ELSE 1 END,
    rm.Id
) directMatch
OUTER APPLY (
  SELECT TOP (1) ordered.*
  FROM (
    SELECT rm.*, ROW_NUMBER() OVER (ORDER BY rm.Id) AS inferredReferenciaDespiece
    FROM dbo.RepuestosManuales rm
    WHERE rm.Activo = 1 AND LTRIM(RTRIM(rm.ManualNombre)) = LTRIM(RTRIM(pv.ManualNombre)) AND rm.Pagina = pv.Pagina
  ) ordered
  WHERE directMatch.Id IS NULL AND ${inferredReferenceNormalized} = ${pointReferenceNormalized}
  ORDER BY ordered.Id
) inferredMatch
OUTER APPLY (SELECT COALESCE(directMatch.Id, inferredMatch.Id) AS Id) selectedMatch
LEFT JOIN dbo.RepuestosManuales matched ON matched.Id = selectedMatch.Id
OUTER APPLY (
  SELECT TOP (1) p.ID_Articulo FROM dbo.Productos p
  WHERE ${sparePartRubrosFilter} AND NULLIF(LTRIM(RTRIM(matched.Codigo)), '') IS NOT NULL
    AND UPPER(LTRIM(RTRIM(p.CodigoAlternativo))) = UPPER(LTRIM(RTRIM(matched.Codigo)))
  ORDER BY p.Descripcion, p.ID_Articulo
) catalogo
WHERE pv.Activo = 1 AND pv.ManualNombre = @manualNombre AND pv.Pagina = @pagina
ORDER BY pv.ReferenciaDespiece, pv.Id;`;
};

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
  matchSource: point.matchSource || 'none',
  manualNombre: point.manualNombre,
  pagina: point.pagina
});

export const getVisualSparePartsPanel = async ({ manualNombre, pagina }) => {
  const pool = await getSqlPool();
  await ensureVisualPointsTable(pool);
  const manual = normalizeManualName(manualNombre);
  const page = normalizePage(pagina);
  if (!manual || !page) return { manualNombre: manual, pagina: page, imageUrl: null, puntos: [] };
  const schema = await getManualSparePartsPanelSchema(pool);
  const result = await pool.request().input('manualNombre', sql.NVarChar(200), manual).input('pagina', sql.Int, page).query(buildPanelQuery(schema));
  const databaseImageUrl = await getManualImageUrl(pool, { manualNombre: manual, pagina: page });
  return { manualNombre: manual, pagina: page, imageUrl: databaseImageUrl || resolveImageUrl(manual, page), puntos: (result.recordset ?? []).map(mapPoint) };
};


const findActiveDuplicateVisualPoint = async (pool, { manualNombre, pagina, referenciaDespiece, excludeId = null }) => {
  const duplicate = await pool.request()
    .input('manualNombre', sql.NVarChar(200), manualNombre)
    .input('pagina', sql.Int, pagina)
    .input('referenciaDespiece', sql.NVarChar(150), referenciaDespiece)
    .input('excludeId', sql.Int, excludeId)
    .query(`
SELECT TOP (1) Id AS id, ManualNombre AS manualNombre, Pagina AS pagina, ReferenciaDespiece AS referenciaDespiece,
  CAST(XPercent AS FLOAT) AS xPercent, CAST(YPercent AS FLOAT) AS yPercent, Activo AS activo
FROM dbo.RepuestosManualesPuntosVisuales
WHERE Activo = 1 AND LTRIM(RTRIM(ManualNombre)) = LTRIM(RTRIM(@manualNombre)) AND Pagina = @pagina
  AND UPPER(LTRIM(RTRIM(ReferenciaDespiece))) = UPPER(LTRIM(RTRIM(@referenciaDespiece)))
  AND (@excludeId IS NULL OR Id <> @excludeId)
ORDER BY Id;`);
  return duplicate.recordset?.[0] ?? null;
};

export const createVisualPoint = async ({ manualNombre, pagina, referenciaDespiece, xPercent, yPercent, activo = true }) => {
  const pool = await getSqlPool(); await ensureVisualPointsTable(pool);
  const manual = normalizeManualName(manualNombre); const page = normalizePage(pagina); const reference = normalizeReference(referenciaDespiece);
  const x = normalizePercent(xPercent); const y = normalizePercent(yPercent);
  if (!manual || !page || !reference || x === null || y === null) throw new Error('Datos inválidos para crear el punto visual. Verificá manual, página, referencia y coordenadas entre 0 y 100.');
  const duplicatePoint = await findActiveDuplicateVisualPoint(pool, { manualNombre: manual, pagina: page, referenciaDespiece: reference });
  if (duplicatePoint) {
    const error = new Error('Ya existe un punto visual activo para este manual, página y referencia. Seleccioná el existente para editarlo.');
    error.statusCode = 409;
    error.duplicatePoint = duplicatePoint;
    throw error;
  }
  const result = await pool.request().input('manualNombre', sql.NVarChar(200), manual).input('pagina', sql.Int, page).input('referenciaDespiece', sql.NVarChar(150), reference).input('xPercent', sql.Decimal(6,3), x).input('yPercent', sql.Decimal(6,3), y).input('activo', sql.Bit, Boolean(activo)).query(`
INSERT INTO dbo.RepuestosManualesPuntosVisuales (ManualNombre, Pagina, ReferenciaDespiece, XPercent, YPercent, Activo)
OUTPUT INSERTED.Id AS id, INSERTED.ManualNombre AS manualNombre, INSERTED.Pagina AS pagina, INSERTED.ReferenciaDespiece AS referenciaDespiece, CAST(INSERTED.XPercent AS FLOAT) AS xPercent, CAST(INSERTED.YPercent AS FLOAT) AS yPercent, INSERTED.Activo AS activo
VALUES (@manualNombre, @pagina, @referenciaDespiece, @xPercent, @yPercent, @activo);`);
  return result.recordset?.[0];
};

export const updateVisualPoint = async (id, data) => {
  const pool = await getSqlPool(); await ensureVisualPointsTable(pool);
  const pointId = Number.parseInt(id, 10); const manual = normalizeManualName(data.manualNombre); const page = normalizePage(data.pagina); const reference = normalizeReference(data.referenciaDespiece); const x = normalizePercent(data.xPercent); const y = normalizePercent(data.yPercent);
  if (!pointId || !manual || !page || !reference || x === null || y === null) throw new Error('Datos inválidos para actualizar el punto visual. Verificá manual, página, referencia y coordenadas entre 0 y 100.');
  const duplicatePoint = await findActiveDuplicateVisualPoint(pool, { manualNombre: manual, pagina: page, referenciaDespiece: reference, excludeId: pointId });
  if (duplicatePoint) {
    const error = new Error('Ya existe otro punto visual activo para este manual, página y referencia.');
    error.statusCode = 409;
    error.duplicatePoint = duplicatePoint;
    throw error;
  }
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
