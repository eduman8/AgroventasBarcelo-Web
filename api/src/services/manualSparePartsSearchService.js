import { getSqlPool, sql } from '../config/sqlServer.js';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
const TOP_CATEGORIES_LIMIT = 8;
const sparePartRubrosFilter = 'p.ID_Rubro IN (3, 4, 8, 11, 13, 24, 26, 27)';

const parsePositiveInteger = (value, defaultValue) => {
  const parsedValue = Number.parseInt(value, 10);

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : defaultValue;
};

const normalizeSearchOptions = ({ search = '', limit = DEFAULT_LIMIT } = {}) => {
  const normalizedSearch = String(search ?? '').trim().slice(0, 150);
  const normalizedLimit = Math.min(parsePositiveInteger(limit, DEFAULT_LIMIT), MAX_LIMIT);

  return {
    search: normalizedSearch,
    limit: normalizedLimit,
    searchTerm: `%${normalizedSearch}%`
  };
};

const normalizeVisualSearchOptions = ({ manual = '', pagina, elemento = '', limit = DEFAULT_LIMIT } = {}) => {
  const normalizedManual = String(manual ?? '').trim().slice(0, 200);
  const normalizedElemento = String(elemento ?? '').trim().slice(0, 150);
  const normalizedPagina = Number.parseInt(pagina, 10);
  const normalizedLimit = Math.min(parsePositiveInteger(limit, DEFAULT_LIMIT), MAX_LIMIT);

  return {
    manual: normalizedManual,
    manualTerm: `%${normalizedManual}%`,
    elemento: normalizedElemento,
    elementoTerm: `%${normalizedElemento}%`,
    pagina: Number.isInteger(normalizedPagina) && normalizedPagina > 0 ? normalizedPagina : null,
    limit: normalizedLimit
  };
};

const getDisplayValue = (value, fallback = '') => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  return value;
};

const mapManualSparePart = (sparePart) => {
  const manual = getDisplayValue(sparePart.manual, 'Sin manual');
  const modelo = getDisplayValue(sparePart.modelo, 'Sin modelo');

  return {
    id: sparePart.id,
    manual,
    manualNombre: manual,
    archivoOrigen: getDisplayValue(sparePart.archivoOrigen),
    pagina: sparePart.pagina,
    codigo: getDisplayValue(sparePart.codigo, 'Sin código'),
    descripcion: getDisplayValue(sparePart.descripcion, 'Sin descripción'),
    marca: getDisplayValue(sparePart.marca, 'Sin marca'),
    modelo,
    modeloMaquina: modelo,
    categoria: getDisplayValue(sparePart.categoria, 'Sin categoría'),
    referenciaDespiece: getDisplayValue(sparePart.referenciaDespiece),
    observaciones: getDisplayValue(sparePart.observaciones),
    existeEnCatalogo: Boolean(sparePart.catalogoId),
    catalogoId: sparePart.catalogoId ?? null,
    catalogoCodigo: sparePart.catalogoCodigo ?? null,
    catalogoNombre: sparePart.catalogoNombre ?? null,
    catalogoMarca: sparePart.catalogoMarca ?? null,
    catalogoDisponible: sparePart.catalogoId ? 'Disponible' : null
  };
};

const mapCountByLabel = ({ label, total }) => ({
  nombre: getDisplayValue(label, 'Sin informar'),
  total: total ?? 0
});

const getManualSparePartsSchema = async (pool) => {
  const result = await pool.request().query(`
    SELECT COLUMN_NAME AS columnName
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = N'dbo'
      AND TABLE_NAME = N'RepuestosManuales';
  `);
  const columnNames = new Set((result.recordset ?? []).map((column) => column.columnName));
  const pickColumn = (candidates, fallback = null) => candidates.find((candidate) => columnNames.has(candidate)) ?? fallback;

  return {
    idColumn: pickColumn(['Id', 'ID_RepuestoManual'], 'ID_RepuestoManual'),
    modelColumn: pickColumn(['Modelo', 'ModeloMaquina']),
    importDateColumn: pickColumn(['FechaCreacion', 'FechaAlta'])
  };
};

const buildManualSparePartsSearchQuery = ({ idColumn, modelColumn }) => {
  const modelSelect = modelColumn ? `rm.${modelColumn}` : 'NULL';
  const modelSearch = modelColumn ? `OR rm.${modelColumn} LIKE @searchTerm` : '';

  return `
SELECT TOP (@limit)
    rm.${idColumn} AS id,
    rm.ManualNombre AS manual,
    rm.ArchivoOrigen AS archivoOrigen,
    rm.Pagina AS pagina,
    rm.Codigo AS codigo,
    rm.Descripcion AS descripcion,
    rm.Marca AS marca,
    ${modelSelect} AS modelo,
    rm.Categoria AS categoria,
    rm.ReferenciaDespiece AS referenciaDespiece,
    rm.Observaciones AS observaciones,
    catalogo.ID_Articulo AS catalogoId,
    catalogo.CodigoAlternativo AS catalogoCodigo,
    catalogo.Nombre AS catalogoNombre,
    catalogo.Marca AS catalogoMarca
FROM dbo.RepuestosManuales rm
OUTER APPLY (
    SELECT TOP (1)
        p.ID_Articulo,
        p.CodigoAlternativo,
        p.Descripcion AS Nombre,
        m.Marca
    FROM dbo.Productos p
    LEFT JOIN dbo.Marcas m
        ON m.ID_Marca = p.ID_Marca
    WHERE ${sparePartRubrosFilter}
      AND NULLIF(LTRIM(RTRIM(rm.Codigo)), '') IS NOT NULL
      AND UPPER(LTRIM(RTRIM(p.CodigoAlternativo))) = UPPER(LTRIM(RTRIM(rm.Codigo)))
    ORDER BY p.Descripcion, p.ID_Articulo
) catalogo
WHERE rm.Activo = 1
  AND (
    @search = ''
    OR rm.Codigo LIKE @searchTerm
    OR rm.Descripcion LIKE @searchTerm
    OR rm.ManualNombre LIKE @searchTerm
    OR rm.Marca LIKE @searchTerm
    ${modelSearch}
    OR rm.Categoria LIKE @searchTerm
    OR rm.ReferenciaDespiece LIKE @searchTerm
  )
ORDER BY
    rm.ManualNombre,
    rm.Pagina,
    rm.Codigo;
`;
};

const buildVisualSparePartsSearchQuery = ({ idColumn, modelColumn }) => {
  const modelSelect = modelColumn ? `rm.${modelColumn}` : 'NULL';

  return `
SELECT TOP (@limit)
    rm.${idColumn} AS id,
    rm.ManualNombre AS manual,
    rm.ArchivoOrigen AS archivoOrigen,
    rm.Pagina AS pagina,
    rm.Codigo AS codigo,
    rm.Descripcion AS descripcion,
    rm.Marca AS marca,
    ${modelSelect} AS modelo,
    rm.Categoria AS categoria,
    rm.ReferenciaDespiece AS referenciaDespiece,
    rm.Observaciones AS observaciones,
    catalogo.ID_Articulo AS catalogoId,
    catalogo.CodigoAlternativo AS catalogoCodigo,
    catalogo.Nombre AS catalogoNombre,
    catalogo.Marca AS catalogoMarca
FROM dbo.RepuestosManuales rm
OUTER APPLY (
    SELECT TOP (1)
        p.ID_Articulo,
        p.CodigoAlternativo,
        p.Descripcion AS Nombre,
        m.Marca
    FROM dbo.Productos p
    LEFT JOIN dbo.Marcas m
        ON m.ID_Marca = p.ID_Marca
    WHERE ${sparePartRubrosFilter}
      AND NULLIF(LTRIM(RTRIM(rm.Codigo)), '') IS NOT NULL
      AND UPPER(LTRIM(RTRIM(p.CodigoAlternativo))) = UPPER(LTRIM(RTRIM(rm.Codigo)))
    ORDER BY p.Descripcion, p.ID_Articulo
) catalogo
WHERE rm.Activo = 1
  AND rm.ManualNombre LIKE @manualTerm
  AND rm.Pagina = @pagina
  AND (
    UPPER(LTRIM(RTRIM(COALESCE(rm.ReferenciaDespiece, '')))) = UPPER(LTRIM(RTRIM(@elemento)))
    OR rm.ReferenciaDespiece LIKE @elementoTerm
    OR (
      NULLIF(LTRIM(RTRIM(COALESCE(rm.ReferenciaDespiece, ''))), '') IS NULL
      AND (
        rm.Observaciones LIKE @elementoTerm
        OR rm.Descripcion LIKE @elementoTerm
      )
    )
  )
ORDER BY
    CASE
      WHEN UPPER(LTRIM(RTRIM(COALESCE(rm.ReferenciaDespiece, '')))) = UPPER(LTRIM(RTRIM(@elemento))) THEN 0
      WHEN rm.ReferenciaDespiece LIKE @elementoTerm THEN 1
      ELSE 2
    END,
    rm.ManualNombre,
    rm.Pagina,
    rm.Codigo;
`;
};

const buildManualSparePartsDiagnosticsQuery = (importDateColumn) => {
  const importDateSelect = importDateColumn ? `MAX(${importDateColumn})` : 'MAX(CAST(NULL AS DATETIME))';

  return `
SELECT *
INTO #manualesActivos
FROM dbo.RepuestosManuales rm
WHERE rm.Activo = 1;

SELECT
    (SELECT COUNT(*) FROM #manualesActivos) AS totalRegistrosManuales,
    (
        SELECT COUNT(*)
        FROM #manualesActivos ma
        WHERE NULLIF(LTRIM(RTRIM(ma.Codigo)), '') IS NOT NULL
          AND EXISTS (
              SELECT 1
              FROM dbo.Productos p
              WHERE ${sparePartRubrosFilter}
                AND UPPER(LTRIM(RTRIM(p.CodigoAlternativo))) = UPPER(LTRIM(RTRIM(ma.Codigo)))
          )
    ) AS registrosConCoincidenciaCatalogo,
    (SELECT ${importDateSelect} FROM #manualesActivos) AS ultimaFechaImportacion;

SELECT
    COALESCE(NULLIF(LTRIM(RTRIM(ManualNombre)), ''), N'Sin manual') AS label,
    COUNT(*) AS total
FROM #manualesActivos
GROUP BY COALESCE(NULLIF(LTRIM(RTRIM(ManualNombre)), ''), N'Sin manual')
ORDER BY total DESC, label ASC;

SELECT TOP (@topCategoriesLimit)
    COALESCE(NULLIF(LTRIM(RTRIM(Categoria)), ''), N'Sin categoría') AS label,
    COUNT(*) AS total
FROM #manualesActivos
GROUP BY COALESCE(NULLIF(LTRIM(RTRIM(Categoria)), ''), N'Sin categoría')
ORDER BY total DESC, label ASC;
`;
};

export const searchManualSpareParts = async (options = {}) => {
  const pool = await getSqlPool();
  const searchOptions = normalizeSearchOptions(options);
  const schema = await getManualSparePartsSchema(pool);
  const result = await pool
    .request()
    .input('limit', sql.Int, searchOptions.limit)
    .input('search', sql.NVarChar(150), searchOptions.search)
    .input('searchTerm', sql.NVarChar(152), searchOptions.searchTerm)
    .query(buildManualSparePartsSearchQuery(schema));

  return {
    data: (result.recordset ?? []).map(mapManualSparePart),
    meta: {
      search: searchOptions.search,
      limit: searchOptions.limit
    }
  };
};

export const searchVisualSpareParts = async (options = {}) => {
  const pool = await getSqlPool();
  const searchOptions = normalizeVisualSearchOptions(options);

  if (!searchOptions.manual || !searchOptions.pagina || !searchOptions.elemento) {
    return {
      data: [],
      meta: {
        manual: searchOptions.manual,
        pagina: searchOptions.pagina,
        elemento: searchOptions.elemento,
        limit: searchOptions.limit
      }
    };
  }

  const schema = await getManualSparePartsSchema(pool);
  const result = await pool
    .request()
    .input('limit', sql.Int, searchOptions.limit)
    .input('manualTerm', sql.NVarChar(202), searchOptions.manualTerm)
    .input('pagina', sql.Int, searchOptions.pagina)
    .input('elemento', sql.NVarChar(150), searchOptions.elemento)
    .input('elementoTerm', sql.NVarChar(152), searchOptions.elementoTerm)
    .query(buildVisualSparePartsSearchQuery(schema));

  return {
    data: (result.recordset ?? []).map(mapManualSparePart),
    meta: {
      manual: searchOptions.manual,
      pagina: searchOptions.pagina,
      elemento: searchOptions.elemento,
      limit: searchOptions.limit
    }
  };
};

export const getManualSparePartsDiagnostics = async () => {
  const pool = await getSqlPool();
  const schema = await getManualSparePartsSchema(pool);
  const result = await pool
    .request()
    .input('topCategoriesLimit', sql.Int, TOP_CATEGORIES_LIMIT)
    .query(buildManualSparePartsDiagnosticsQuery(schema.importDateColumn));

  const totals = result.recordsets?.[0]?.[0] ?? {};
  const totalRegistrosManuales = totals.totalRegistrosManuales ?? 0;
  const registrosConCoincidenciaCatalogo = totals.registrosConCoincidenciaCatalogo ?? 0;
  const registrosSoloManual = Math.max(totalRegistrosManuales - registrosConCoincidenciaCatalogo, 0);
  const porcentajeCoincidenciaCatalogo = totalRegistrosManuales > 0
    ? Number(((registrosConCoincidenciaCatalogo / totalRegistrosManuales) * 100).toFixed(2))
    : 0;

  return {
    totalRegistrosManuales,
    registrosPorManual: (result.recordsets?.[1] ?? []).map(mapCountByLabel),
    registrosConCoincidenciaCatalogo,
    registrosSoloManual,
    porcentajeCoincidenciaCatalogo,
    ultimaFechaImportacion: totals.ultimaFechaImportacion ?? null,
    topCategorias: (result.recordsets?.[2] ?? []).map(mapCountByLabel)
  };
};
