import { getSqlPool, sql } from '../config/sqlServer.js';

const sparePartRubrosFilter = 'p.ID_Rubro IN (3, 4, 8, 11, 13, 24, 26, 27)';

const sparePartsCountQuery = `
SELECT COUNT(*) AS total
FROM dbo.Productos p
LEFT JOIN dbo.Marcas m
    ON m.ID_Marca = p.ID_Marca
WHERE ${sparePartRubrosFilter}
  AND (
    @search = ''
    OR p.Descripcion LIKE @searchTerm
    OR p.CodigoAlternativo LIKE @searchTerm
    OR m.Marca LIKE @searchTerm
  );
`;

const sparePartsQuery = `
SELECT
    p.ID_Articulo AS id,
    p.Descripcion AS nombre,
    p.CodigoAlternativo AS codigo,
    r.Descripcion AS rubro,
    sr.Descripcion AS subRubro,
    m.Marca AS marca
FROM dbo.Productos p
LEFT JOIN dbo.Rubros r
    ON r.ID_Rubro = p.ID_Rubro
LEFT JOIN dbo.SubRubros sr
    ON sr.ID_SubRubro = p.ID_SubRubro
LEFT JOIN dbo.Marcas m
    ON m.ID_Marca = p.ID_Marca
WHERE ${sparePartRubrosFilter}
  AND (
    @search = ''
    OR p.Descripcion LIKE @searchTerm
    OR p.CodigoAlternativo LIKE @searchTerm
    OR m.Marca LIKE @searchTerm
  )
ORDER BY p.Descripcion, p.ID_Articulo
OFFSET @offset ROWS
FETCH NEXT @limit ROWS ONLY;
`;

const sparePartByIdQuery = `
SELECT TOP (1)
    p.ID_Articulo AS id,
    p.Descripcion AS nombre,
    p.CodigoAlternativo AS codigo,
    r.Descripcion AS rubro,
    sr.Descripcion AS subRubro,
    m.Marca AS marca
FROM dbo.Productos p
LEFT JOIN dbo.Rubros r
    ON r.ID_Rubro = p.ID_Rubro
LEFT JOIN dbo.SubRubros sr
    ON sr.ID_SubRubro = p.ID_SubRubro
LEFT JOIN dbo.Marcas m
    ON m.ID_Marca = p.ID_Marca
LEFT JOIN (
    SELECT DISTINCT ID_Articulo
    FROM dbo.vwStockExistencia
) se
    ON se.ID_Articulo = p.ID_Articulo
WHERE ${sparePartRubrosFilter}
  AND p.ID_Articulo = @id;
`;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const getDisplayValue = (value, fallback) => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  return value;
};

const parsePositiveInteger = (value, defaultValue) => {
  const parsedValue = Number.parseInt(value, 10);

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : defaultValue;
};

const normalizePaginationOptions = ({ page = DEFAULT_PAGE, limit = DEFAULT_LIMIT, search = '' } = {}) => {
  const normalizedPage = parsePositiveInteger(page, DEFAULT_PAGE);
  const normalizedLimit = Math.min(parsePositiveInteger(limit, DEFAULT_LIMIT), MAX_LIMIT);
  const normalizedSearch = String(search ?? '').trim().slice(0, 150);

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    offset: (normalizedPage - 1) * normalizedLimit,
    search: normalizedSearch,
    searchTerm: `%${normalizedSearch}%`
  };
};

const addSparePartsInputs = (request, { limit, offset, search, searchTerm }) => {
  request.input('limit', sql.Int, limit);
  request.input('offset', sql.Int, offset);
  request.input('search', sql.NVarChar(150), search);
  request.input('searchTerm', sql.NVarChar(152), searchTerm);

  return request;
};

const mapSparePart = (sparePart) => ({
  id: sparePart.id,
  nombre: sparePart.nombre,
  codigo: sparePart.codigo,
  rubro: getDisplayValue(sparePart.rubro, 'Sin rubro'),
  subRubro: getDisplayValue(sparePart.subRubro, 'Sin subrubro'),
  marca: getDisplayValue(sparePart.marca, 'Sin marca'),
  disponibilidad: 'Disponible'
});

export const getSparePartsCount = async () => {
  const pool = await getSqlPool();
  const result = await pool.request().query(`
    SELECT COUNT(*) AS total
    FROM dbo.Productos p
    WHERE ${sparePartRubrosFilter};
  `);

  return { total: result.recordset?.[0]?.total ?? 0 };
};

export const getSpareParts = async (options = {}) => {
  const pool = await getSqlPool();
  const paginationOptions = normalizePaginationOptions(options);
  const countRequest = addSparePartsInputs(pool.request(), paginationOptions);
  const dataRequest = addSparePartsInputs(pool.request(), paginationOptions);

  const [countResult, dataResult] = await Promise.all([
    countRequest.query(sparePartsCountQuery),
    dataRequest.query(sparePartsQuery)
  ]);
  const total = countResult.recordset?.[0]?.total ?? 0;

  return {
    data: (dataResult.recordset ?? []).map(mapSparePart),
    pagination: {
      total,
      page: paginationOptions.page,
      limit: paginationOptions.limit,
      totalPages: Math.ceil(total / paginationOptions.limit)
    }
  };
};

export const getSparePartById = async (id) => {
  const sparePartId = parsePositiveInteger(id, null);

  if (!sparePartId) {
    return null;
  }

  const pool = await getSqlPool();
  const result = await pool
    .request()
    .input('id', sql.Int, sparePartId)
    .query(sparePartByIdQuery);
  const sparePart = result.recordset?.[0];

  return sparePart ? mapSparePart(sparePart) : null;
};
