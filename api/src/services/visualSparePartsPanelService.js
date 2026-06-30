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
const normalizeDataPageMode = (value) => ['same', 'previous', 'next', 'custom'].includes(value) ? value : 'same';
const getPageByMode = (visualPage, mode, customPage = null) => {
  if (mode === 'previous') return Math.max(1, visualPage - 1);
  if (mode === 'next') return visualPage + 1;
  if (mode === 'custom') return normalizePage(customPage) ?? visualPage;
  return visualPage;
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
const isDevelopment = process.env.NODE_ENV !== 'production';
const PANEL_DIAGNOSTIC_MANUAL = 'Repuestos Rastras';
const PANEL_DIAGNOSTIC_PAGE = 6;


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
IF NOT EXISTS (SELECT 1 FROM sys.tables t INNER JOIN sys.schemas s ON s.schema_id = t.schema_id WHERE t.name = N'RepuestosManualesPaginasVisuales' AND s.name = N'dbo')
BEGIN
  CREATE TABLE dbo.RepuestosManualesPaginasVisuales (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ManualNombre NVARCHAR(200) NOT NULL,
    PaginaVisual INT NOT NULL,
    PaginaDatos INT NOT NULL,
    Activo BIT NOT NULL CONSTRAINT DF_RepuestosManualesPaginasVisuales_Activo DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_RepuestosManualesPaginasVisuales_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL
  );
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_RepuestosManualesPaginasVisuales_ManualPaginaVisual' AND object_id = OBJECT_ID(N'dbo.RepuestosManualesPaginasVisuales'))
BEGIN
  CREATE UNIQUE INDEX UX_RepuestosManualesPaginasVisuales_ManualPaginaVisual ON dbo.RepuestosManualesPaginasVisuales (ManualNombre, PaginaVisual);
END;
IF NOT EXISTS (SELECT 1 FROM sys.tables t INNER JOIN sys.schemas s ON s.schema_id = t.schema_id WHERE t.name = N'RepuestosManualesPuntosVisuales' AND s.name = N'dbo')
BEGIN
  CREATE TABLE dbo.RepuestosManualesPuntosVisuales (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ManualNombre NVARCHAR(200) NOT NULL,
    Pagina INT NOT NULL,
    ReferenciaDespiece NVARCHAR(150) NOT NULL,
    RepuestoManualId INT NULL,
    XPercent DECIMAL(6,3) NOT NULL,
    YPercent DECIMAL(6,3) NOT NULL,
    Activo BIT NOT NULL CONSTRAINT DF_RepuestosManualesPuntosVisuales_Activo DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_RepuestosManualesPuntosVisuales_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NULL
  );
END;
IF COL_LENGTH(N'dbo.RepuestosManualesPuntosVisuales', N'RepuestoManualId') IS NULL
BEGIN
  ALTER TABLE dbo.RepuestosManualesPuntosVisuales ADD RepuestoManualId INT NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_RepuestosManualesPuntosVisuales_RepuestoManualId' AND object_id = OBJECT_ID(N'dbo.RepuestosManualesPuntosVisuales'))
BEGIN
  CREATE INDEX IX_RepuestosManualesPuntosVisuales_RepuestoManualId ON dbo.RepuestosManualesPuntosVisuales (RepuestoManualId) WHERE RepuestoManualId IS NOT NULL;
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
SELECT pv.Id AS id, pv.ManualNombre AS manualNombre, pv.Pagina AS pagina, pv.ReferenciaDespiece AS referenciaDespiece, pv.RepuestoManualId AS repuestoManualId,
  CAST(pv.XPercent AS FLOAT) AS xPercent, CAST(pv.YPercent AS FLOAT) AS yPercent, pv.Activo AS activo,
  matched.Codigo AS codigo, matched.Descripcion AS descripcion, matched.Categoria AS categoria, matched.Marca AS marca, ${modelSelect} AS modelo,
  CASE WHEN manualLink.Id IS NOT NULL THEN 'manualLink' WHEN directMatch.Id IS NOT NULL THEN 'direct' WHEN inferredMatch.Id IS NOT NULL THEN 'inferredByPageOrder' ELSE 'none' END AS matchSource,
  manualLink.Id AS manualLinkId, directMatch.Id AS directMatchId, inferredMatch.Id AS inferredMatchId,
  inferredMatch.inferredReferenciaDespiece AS inferredRowNumber, inferredMatch.Codigo AS inferredCodigo,
  inferredMatch.Descripcion AS inferredDescripcion, inferredMatch.Categoria AS inferredCategoria,
  catalogo.ID_Articulo AS repuestoCatalogoId
FROM dbo.RepuestosManualesPuntosVisuales pv
OUTER APPLY (
  SELECT TOP (1) rm.* FROM dbo.RepuestosManuales rm
  WHERE rm.Activo = 1 AND rm.Id = pv.RepuestoManualId
  ORDER BY rm.Id
) manualLink
OUTER APPLY (
  SELECT TOP (1) rm.* FROM dbo.RepuestosManuales rm
  WHERE manualLink.Id IS NULL AND rm.Activo = 1 AND LTRIM(RTRIM(rm.ManualNombre)) = LTRIM(RTRIM(pv.ManualNombre)) AND rm.Pagina = @paginaDatos
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
    WHERE LTRIM(RTRIM(rm.ManualNombre)) = LTRIM(RTRIM(pv.ManualNombre)) AND rm.Pagina = @paginaDatos
  ) ordered
  WHERE manualLink.Id IS NULL AND directMatch.Id IS NULL AND ${inferredReferenceNormalized} = ${pointReferenceNormalized}
  ORDER BY ordered.Id
) inferredMatch
OUTER APPLY (SELECT COALESCE(manualLink.Id, directMatch.Id, inferredMatch.Id) AS Id) selectedMatch
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


const buildPanelDiagnosticSqlForSsms = ({ manualNombre = PANEL_DIAGNOSTIC_MANUAL, pagina = PANEL_DIAGNOSTIC_PAGE } = {}) => {
  const directManualReferenceNormalized = buildNormalizedReferenceExpression('rm.ReferenciaDespiece');
  const inferredReferenceNormalized = buildNormalizedReferenceExpression('CONVERT(NVARCHAR(150), ordered.inferredReferenciaDespiece)');
  const pointReferenceNormalized = buildNormalizedReferenceExpression('pv.ReferenciaDespiece');
  const escapedManualName = String(manualNombre).replaceAll("'", "''");

  return `DECLARE @manualNombre NVARCHAR(200) = N'${escapedManualName}';
DECLARE @pagina INT = ${Number.parseInt(pagina, 10) || PANEL_DIAGNOSTIC_PAGE};

-- 1) Todos los puntos visuales de Repuestos Rastras página 6.
SELECT pv.Id, pv.ManualNombre, pv.Pagina, pv.ReferenciaDespiece, pv.XPercent, pv.YPercent, pv.Activo, pv.CreatedAt, pv.UpdatedAt
FROM dbo.RepuestosManualesPuntosVisuales pv
WHERE LTRIM(RTRIM(pv.ManualNombre)) = LTRIM(RTRIM(@manualNombre))
  AND pv.Pagina = @pagina
ORDER BY TRY_CONVERT(INT, pv.ReferenciaDespiece), pv.ReferenciaDespiece, pv.Id;

-- 2) Auditoría de filtros del fallback ROW_NUMBER().
--    Esta consulta muestra cuántas filas quedan al aplicar cada filtro históricamente sospechoso.
SELECT
  COUNT(1) AS filasMismoManualYPagina,
  SUM(CASE WHEN rm.Activo = 1 THEN 1 ELSE 0 END) AS filasActivas,
  SUM(CASE WHEN NULLIF(LTRIM(RTRIM(rm.Categoria)), '') IS NOT NULL THEN 1 ELSE 0 END) AS filasConCategoria,
  SUM(CASE WHEN NULLIF(LTRIM(RTRIM(rm.ReferenciaDespiece)), '') IS NOT NULL THEN 1 ELSE 0 END) AS filasConReferenciaDespiece,
  SUM(CASE WHEN NULLIF(LTRIM(RTRIM(rm.Codigo)), '') IS NOT NULL THEN 1 ELSE 0 END) AS filasConCodigo
FROM dbo.RepuestosManuales rm
WHERE LTRIM(RTRIM(rm.ManualNombre)) = LTRIM(RTRIM(@manualNombre))
  AND rm.Pagina = @pagina;

-- 3) Subconsulta exacta que genera ROW_NUMBER(), sin OUTER APPLY ni TOP(1).
--    Importante: no filtra Activo/Categoria/ReferenciaDespiece/Codigo porque el fallback debe
--    numerar todas las filas importadas de la página para conservar el orden visual del manual.
WITH manualRows AS (
  SELECT rm.*, ROW_NUMBER() OVER (ORDER BY rm.Id) AS inferredReferenciaDespiece
  FROM dbo.RepuestosManuales rm
  WHERE LTRIM(RTRIM(rm.ManualNombre)) = LTRIM(RTRIM(@manualNombre))
    AND rm.Pagina = @pagina
)
SELECT inferredReferenciaDespiece, Id, ManualNombre, Pagina, ReferenciaDespiece, Codigo, Descripcion, Categoria, Marca, Activo
FROM manualRows
ORDER BY inferredReferenciaDespiece;

-- 4) Resultado del cruce final para referencias visuales 1 a 8.
WITH puntos AS (
  SELECT pv.*
  FROM dbo.RepuestosManualesPuntosVisuales pv
  WHERE pv.Activo = 1
    AND LTRIM(RTRIM(pv.ManualNombre)) = LTRIM(RTRIM(@manualNombre))
    AND pv.Pagina = @pagina
    AND TRY_CONVERT(INT, pv.ReferenciaDespiece) BETWEEN 1 AND 8
)
SELECT pv.ReferenciaDespiece AS referenciaVisual,
  manualLink.Id AS manualLinkId,
  CASE WHEN directMatch.Id IS NULL THEN 0 ELSE 1 END AS matchDirectoEncontrado,
  directMatch.Id AS directMatchId,
  CASE WHEN inferredMatch.Id IS NULL THEN 0 ELSE 1 END AS matchInferidoEncontrado,
  inferredMatch.inferredReferenciaDespiece AS rowNumberInferidoUsado,
  inferredMatch.Id AS filaSqlInferidaId,
  inferredMatch.Codigo AS codigoInferido,
  inferredMatch.Descripcion AS descripcionInferida,
  inferredMatch.Categoria AS categoriaInferida,
  matched.Codigo AS codigo,
  matched.Descripcion AS descripcion,
  matched.Categoria AS categoria,
  CASE WHEN manualLink.Id IS NOT NULL THEN 'manualLink' WHEN directMatch.Id IS NOT NULL THEN 'direct' WHEN inferredMatch.Id IS NOT NULL THEN 'inferredByPageOrder' ELSE 'none' END AS matchSource
FROM puntos pv
OUTER APPLY (
  SELECT TOP (1) rm.*
  FROM dbo.RepuestosManuales rm
  WHERE rm.Activo = 1 AND rm.Id = pv.RepuestoManualId
  ORDER BY rm.Id
) manualLink
OUTER APPLY (
  SELECT TOP (1) rm.*
  FROM dbo.RepuestosManuales rm
  WHERE manualLink.Id IS NULL AND rm.Activo = 1
    AND LTRIM(RTRIM(rm.ManualNombre)) = LTRIM(RTRIM(pv.ManualNombre))
    AND rm.Pagina = @pagina
    AND ${directManualReferenceNormalized} = ${pointReferenceNormalized}
    AND (NULLIF(LTRIM(RTRIM(rm.Codigo)), '') IS NOT NULL OR NULLIF(LTRIM(RTRIM(rm.Descripcion)), '') IS NOT NULL)
  ORDER BY CASE WHEN UPPER(LTRIM(RTRIM(COALESCE(rm.ReferenciaDespiece, '')))) = UPPER(LTRIM(RTRIM(pv.ReferenciaDespiece))) THEN 0 ELSE 1 END, rm.Id
) directMatch
OUTER APPLY (
  SELECT TOP (1) ordered.*
  FROM (
    SELECT rm.*, ROW_NUMBER() OVER (ORDER BY rm.Id) AS inferredReferenciaDespiece
    FROM dbo.RepuestosManuales rm
    WHERE LTRIM(RTRIM(rm.ManualNombre)) = LTRIM(RTRIM(pv.ManualNombre))
      AND rm.Pagina = @pagina
  ) ordered
  WHERE manualLink.Id IS NULL AND directMatch.Id IS NULL AND ${inferredReferenceNormalized} = ${pointReferenceNormalized}
  ORDER BY ordered.Id
) inferredMatch
OUTER APPLY (SELECT COALESCE(manualLink.Id, directMatch.Id, inferredMatch.Id) AS Id) selectedMatch
LEFT JOIN dbo.RepuestosManuales matched ON matched.Id = selectedMatch.Id
ORDER BY TRY_CONVERT(INT, pv.ReferenciaDespiece), pv.ReferenciaDespiece, pv.Id;`;
};

const logPanelDiagnostics = ({ manualNombre, pagina, rows }) => {
  if (!isDevelopment || manualNombre !== PANEL_DIAGNOSTIC_MANUAL || pagina !== PANEL_DIAGNOSTIC_PAGE) return;

  console.info('[visual-spare-parts-panel:diagnostic] SSMS query for Repuestos Rastras page 6:\n%s', buildPanelDiagnosticSqlForSsms());
  console.table((rows ?? []).map((row) => ({
    referenciaVisual: row.referenciaDespiece,
    matchDirectoEncontrado: Boolean(row.directMatchId),
    matchInferidoEncontrado: Boolean(row.inferredMatchId),
    filaSqlInferidaUsada: row.inferredMatchId ? `ROW_NUMBER=${row.inferredRowNumber}; Id=${row.inferredMatchId}` : null,
    codigo: row.codigo ?? null,
    descripcion: row.descripcion ?? null,
    categoria: row.categoria ?? null,
    matchSource: row.matchSource || 'none'
  })));
};

const mapPoint = (point) => ({
  id: point.id,
  repuestoManualId: point.repuestoManualId ?? null,
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

export const getVisualDataPageConfig = async ({ manualNombre, pagina }) => {
  const pool = await getSqlPool();
  await ensureVisualPointsTable(pool);
  const manual = normalizeManualName(manualNombre);
  const visualPage = normalizePage(pagina);
  if (!manual || !visualPage) return { manualNombre: manual, paginaVisual: visualPage, paginaDatos: visualPage, mode: 'same', hasCustomConfig: false };
  const result = await pool.request()
    .input('manualNombre', sql.NVarChar(200), manual)
    .input('paginaVisual', sql.Int, visualPage)
    .query(`
SELECT TOP (1) PaginaDatos AS paginaDatos
FROM dbo.RepuestosManualesPaginasVisuales
WHERE Activo = 1 AND LTRIM(RTRIM(ManualNombre)) = LTRIM(RTRIM(@manualNombre)) AND PaginaVisual = @paginaVisual
ORDER BY Id DESC;`);
  const dataPage = normalizePage(result.recordset?.[0]?.paginaDatos) ?? visualPage;
  const diff = dataPage - visualPage;
  const mode = diff === -1 ? 'previous' : diff === 0 ? 'same' : diff === 1 ? 'next' : 'custom';
  return { manualNombre: manual, paginaVisual: visualPage, paginaDatos: dataPage, mode, hasCustomConfig: Boolean(result.recordset?.[0]) };
};

export const saveVisualDataPageConfig = async ({ manualNombre, paginaVisual, paginaDatos, mode = 'custom' }) => {
  const pool = await getSqlPool();
  await ensureVisualPointsTable(pool);
  const manual = normalizeManualName(manualNombre);
  const visualPage = normalizePage(paginaVisual);
  const dataPage = visualPage ? getPageByMode(visualPage, normalizeDataPageMode(mode), paginaDatos) : null;
  if (!manual || !visualPage || !dataPage) throw new Error('Datos inválidos para configurar la página de datos.');
  const result = await pool.request()
    .input('manualNombre', sql.NVarChar(200), manual)
    .input('paginaVisual', sql.Int, visualPage)
    .input('paginaDatos', sql.Int, dataPage)
    .query(`
MERGE dbo.RepuestosManualesPaginasVisuales AS target
USING (SELECT @manualNombre AS ManualNombre, @paginaVisual AS PaginaVisual) AS source
ON LTRIM(RTRIM(target.ManualNombre)) = LTRIM(RTRIM(source.ManualNombre)) AND target.PaginaVisual = source.PaginaVisual
WHEN MATCHED THEN UPDATE SET PaginaDatos = @paginaDatos, Activo = 1, UpdatedAt = SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT (ManualNombre, PaginaVisual, PaginaDatos, Activo) VALUES (@manualNombre, @paginaVisual, @paginaDatos, 1)
OUTPUT INSERTED.Id AS id, INSERTED.ManualNombre AS manualNombre, INSERTED.PaginaVisual AS paginaVisual, INSERTED.PaginaDatos AS paginaDatos, INSERTED.Activo AS activo;`);
  return result.recordset?.[0];
};

export const applyVisualDataPageOffset = async ({ manualNombre, mode = 'previous' }) => {
  const pool = await getSqlPool();
  await ensureVisualPointsTable(pool);
  const manual = normalizeManualName(manualNombre);
  const normalizedMode = normalizeDataPageMode(mode);
  if (!manual) throw new Error('Ingresá el manual para aplicar la acción masiva.');
  const offset = normalizedMode === 'previous' ? -1 : normalizedMode === 'next' ? 1 : 0;
  const result = await pool.request()
    .input('manualNombre', sql.NVarChar(200), manual)
    .input('offset', sql.Int, offset)
    .query(`
WITH visualPages AS (
  SELECT ManualNombre, Pagina AS PaginaVisual FROM dbo.RepuestosManualesImagenes WHERE Activo = 1 AND LTRIM(RTRIM(ManualNombre)) = LTRIM(RTRIM(@manualNombre))
  UNION
  SELECT ManualNombre, Pagina AS PaginaVisual FROM dbo.RepuestosManualesPuntosVisuales WHERE Activo = 1 AND LTRIM(RTRIM(ManualNombre)) = LTRIM(RTRIM(@manualNombre))
), prepared AS (
  SELECT LTRIM(RTRIM(@manualNombre)) AS ManualNombre, PaginaVisual, CASE WHEN PaginaVisual + @offset < 1 THEN 1 ELSE PaginaVisual + @offset END AS PaginaDatos FROM visualPages
)
MERGE dbo.RepuestosManualesPaginasVisuales AS target
USING prepared AS source
ON LTRIM(RTRIM(target.ManualNombre)) = LTRIM(RTRIM(source.ManualNombre)) AND target.PaginaVisual = source.PaginaVisual
WHEN MATCHED THEN UPDATE SET PaginaDatos = source.PaginaDatos, Activo = 1, UpdatedAt = SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT (ManualNombre, PaginaVisual, PaginaDatos, Activo) VALUES (source.ManualNombre, source.PaginaVisual, source.PaginaDatos, 1);
SELECT @@ROWCOUNT AS affectedRows;`);
  return { manualNombre: manual, mode: normalizedMode, affectedRows: result.recordset?.[0]?.affectedRows ?? 0 };
};

export const getVisualSparePartsPanel = async ({ manualNombre, pagina }) => {
  const pool = await getSqlPool();
  await ensureVisualPointsTable(pool);
  const manual = normalizeManualName(manualNombre);
  const page = normalizePage(pagina);
  if (!manual || !page) return { manualNombre: manual, pagina: page, imageUrl: null, puntos: [] };
  const schema = await getManualSparePartsPanelSchema(pool);
  const dataPageConfig = await getVisualDataPageConfig({ manualNombre: manual, pagina: page });
  const result = await pool.request().input('manualNombre', sql.NVarChar(200), manual).input('pagina', sql.Int, page).input('paginaDatos', sql.Int, dataPageConfig.paginaDatos).query(buildPanelQuery(schema));
  logPanelDiagnostics({ manualNombre: manual, pagina: page, rows: result.recordset ?? [] });
  const databaseImageUrl = await getManualImageUrl(pool, { manualNombre: manual, pagina: page });
  return { manualNombre: manual, pagina: page, paginaVisual: page, paginaDatos: dataPageConfig.paginaDatos, dataPageConfig, imageUrl: databaseImageUrl || resolveImageUrl(manual, page), puntos: (result.recordset ?? []).map(mapPoint) };
};


const findActiveDuplicateVisualPoint = async (pool, { manualNombre, pagina, referenciaDespiece, excludeId = null }) => {
  const duplicate = await pool.request()
    .input('manualNombre', sql.NVarChar(200), manualNombre)
    .input('pagina', sql.Int, pagina)
    .input('referenciaDespiece', sql.NVarChar(150), referenciaDespiece)
    .input('excludeId', sql.Int, excludeId)
    .query(`
SELECT TOP (1) Id AS id, ManualNombre AS manualNombre, Pagina AS pagina, ReferenciaDespiece AS referenciaDespiece, RepuestoManualId AS repuestoManualId,
  CAST(XPercent AS FLOAT) AS xPercent, CAST(YPercent AS FLOAT) AS yPercent, Activo AS activo
FROM dbo.RepuestosManualesPuntosVisuales
WHERE Activo = 1 AND LTRIM(RTRIM(ManualNombre)) = LTRIM(RTRIM(@manualNombre)) AND Pagina = @pagina
  AND UPPER(LTRIM(RTRIM(ReferenciaDespiece))) = UPPER(LTRIM(RTRIM(@referenciaDespiece)))
  AND (@excludeId IS NULL OR Id <> @excludeId)
ORDER BY Id;`);
  return duplicate.recordset?.[0] ?? null;
};

const normalizeRepuestoManualId = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export const createVisualPoint = async ({ manualNombre, pagina, referenciaDespiece, xPercent, yPercent, activo = true, repuestoManualId = null }) => {
  const pool = await getSqlPool(); await ensureVisualPointsTable(pool);
  const manual = normalizeManualName(manualNombre); const page = normalizePage(pagina); const reference = normalizeReference(referenciaDespiece);
  const x = normalizePercent(xPercent); const y = normalizePercent(yPercent); const manualPartId = normalizeRepuestoManualId(repuestoManualId);
  if (!manual || !page || !reference || x === null || y === null) throw new Error('Datos inválidos para crear el punto visual. Verificá manual, página, referencia y coordenadas entre 0 y 100.');
  const duplicatePoint = await findActiveDuplicateVisualPoint(pool, { manualNombre: manual, pagina: page, referenciaDespiece: reference });
  if (duplicatePoint) {
    const error = new Error('Ya existe un punto visual activo para este manual, página y referencia. Seleccioná el existente para editarlo.');
    error.statusCode = 409;
    error.duplicatePoint = duplicatePoint;
    throw error;
  }
  const result = await pool.request().input('manualNombre', sql.NVarChar(200), manual).input('pagina', sql.Int, page).input('referenciaDespiece', sql.NVarChar(150), reference).input('xPercent', sql.Decimal(6,3), x).input('yPercent', sql.Decimal(6,3), y).input('activo', sql.Bit, Boolean(activo)).input('repuestoManualId', sql.Int, manualPartId).query(`
INSERT INTO dbo.RepuestosManualesPuntosVisuales (ManualNombre, Pagina, ReferenciaDespiece, RepuestoManualId, XPercent, YPercent, Activo)
OUTPUT INSERTED.Id AS id, INSERTED.ManualNombre AS manualNombre, INSERTED.Pagina AS pagina, INSERTED.ReferenciaDespiece AS referenciaDespiece, INSERTED.RepuestoManualId AS repuestoManualId, CAST(INSERTED.XPercent AS FLOAT) AS xPercent, CAST(INSERTED.YPercent AS FLOAT) AS yPercent, INSERTED.Activo AS activo
VALUES (@manualNombre, @pagina, @referenciaDespiece, @repuestoManualId, @xPercent, @yPercent, @activo);`);
  return result.recordset?.[0];
};

export const updateVisualPoint = async (id, data) => {
  const pool = await getSqlPool(); await ensureVisualPointsTable(pool);
  const pointId = Number.parseInt(id, 10); const manual = normalizeManualName(data.manualNombre); const page = normalizePage(data.pagina); const reference = normalizeReference(data.referenciaDespiece); const x = normalizePercent(data.xPercent); const y = normalizePercent(data.yPercent); const manualPartId = normalizeRepuestoManualId(data.repuestoManualId);
  if (!pointId || !manual || !page || !reference || x === null || y === null) throw new Error('Datos inválidos para actualizar el punto visual. Verificá manual, página, referencia y coordenadas entre 0 y 100.');
  const duplicatePoint = await findActiveDuplicateVisualPoint(pool, { manualNombre: manual, pagina: page, referenciaDespiece: reference, excludeId: pointId });
  if (duplicatePoint) {
    const error = new Error('Ya existe otro punto visual activo para este manual, página y referencia.');
    error.statusCode = 409;
    error.duplicatePoint = duplicatePoint;
    throw error;
  }
  const result = await pool.request().input('id', sql.Int, pointId).input('manualNombre', sql.NVarChar(200), manual).input('pagina', sql.Int, page).input('referenciaDespiece', sql.NVarChar(150), reference).input('xPercent', sql.Decimal(6,3), x).input('yPercent', sql.Decimal(6,3), y).input('activo', sql.Bit, data.activo !== false).input('repuestoManualId', sql.Int, manualPartId).query(`
UPDATE dbo.RepuestosManualesPuntosVisuales SET ManualNombre=@manualNombre, Pagina=@pagina, ReferenciaDespiece=@referenciaDespiece, RepuestoManualId=@repuestoManualId, XPercent=@xPercent, YPercent=@yPercent, Activo=@activo, UpdatedAt=SYSUTCDATETIME()
OUTPUT INSERTED.Id AS id, INSERTED.ManualNombre AS manualNombre, INSERTED.Pagina AS pagina, INSERTED.ReferenciaDespiece AS referenciaDespiece, INSERTED.RepuestoManualId AS repuestoManualId, CAST(INSERTED.XPercent AS FLOAT) AS xPercent, CAST(INSERTED.YPercent AS FLOAT) AS yPercent, INSERTED.Activo AS activo
WHERE Id=@id;`);
  return result.recordset?.[0] ?? null;
};

export const searchManualSparePartsForVisualPage = async ({ manualNombre, paginaDatos, search = '' }) => {
  const pool = await getSqlPool();
  await ensureVisualPointsTable(pool);
  const manual = normalizeManualName(manualNombre);
  const dataPage = normalizePage(paginaDatos);
  const normalizedSearch = String(search ?? '').trim().slice(0, 150);
  if (!manual || !dataPage) return [];

  const likeSearch = `%${normalizedSearch}%`;
  const result = await pool.request()
    .input('manualNombre', sql.NVarChar(200), manual)
    .input('paginaDatos', sql.Int, dataPage)
    .input('search', sql.NVarChar(152), likeSearch)
    .query(`
SELECT TOP (50) Id AS id, Pagina AS pagina, PaginaImpresa AS paginaImpresa, ReferenciaDespiece AS referenciaDespiece,
  Codigo AS codigo, Descripcion AS descripcion, Categoria AS categoria, Marca AS marca, ModeloMaquina AS modelo
FROM dbo.RepuestosManuales
WHERE Activo = 1
  AND LTRIM(RTRIM(ManualNombre)) = LTRIM(RTRIM(@manualNombre))
  AND Pagina = @paginaDatos
  AND (
    @search = N'%%'
    OR Codigo LIKE @search
    OR Descripcion LIKE @search
    OR ReferenciaDespiece LIKE @search
    OR Categoria LIKE @search
  )
ORDER BY Id;`);
  return result.recordset ?? [];
};

export const deleteVisualPoint = async (id) => {
  const pool = await getSqlPool(); await ensureVisualPointsTable(pool);
  const pointId = Number.parseInt(id, 10); if (!pointId) return false;
  const result = await pool.request().input('id', sql.Int, pointId).query('UPDATE dbo.RepuestosManualesPuntosVisuales SET Activo = 0, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id;');
  return result.rowsAffected?.[0] > 0;
};
