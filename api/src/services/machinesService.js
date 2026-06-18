import { getSqlPool, sql } from '../config/sqlServer.js';

const publicMachinesQuery = `
SELECT
    ID_WebMaquinaria AS id,
    Slug AS slug,
    Nombre AS nombre,
    Marca AS marca,
    Categoria AS categoria,
    Estado AS estado,
    DescripcionCorta AS descripcionCorta,
    DescripcionLarga AS descripcionLarga,
    ImagenPrincipal AS imagenPrincipal,
    Galeria AS galeria,
    Disponible AS disponible,
    Activo AS activo
FROM dbo.WebMaquinarias
WHERE Activo = 1
  AND (
    Disponible = 1
    OR LOWER(LTRIM(RTRIM(Estado))) IN (N'vendido', N'vendida', N'finalizado', N'finalizada', N'trabajo realizado', N'trabajos realizados')
    OR LOWER(LTRIM(RTRIM(Categoria))) IN (N'trabajo realizado', N'trabajos realizados')
  )
ORDER BY
    CASE
      WHEN Disponible = 1
        AND LOWER(LTRIM(RTRIM(Estado))) NOT IN (N'vendido', N'vendida', N'finalizado', N'finalizada') THEN 0
      ELSE 1
    END,
    FechaAlta DESC,
    ID_WebMaquinaria DESC;
`;

const publicMachineByIdentifierQuery = `
SELECT TOP (1)
    ID_WebMaquinaria AS id,
    Slug AS slug,
    Nombre AS nombre,
    Marca AS marca,
    Categoria AS categoria,
    Estado AS estado,
    DescripcionCorta AS descripcionCorta,
    DescripcionLarga AS descripcionLarga,
    ImagenPrincipal AS imagenPrincipal,
    Galeria AS galeria,
    Disponible AS disponible,
    Activo AS activo
FROM dbo.WebMaquinarias
WHERE Activo = 1
  AND (Slug = @identifier OR (@id IS NOT NULL AND ID_WebMaquinaria = @id))
ORDER BY
    CASE WHEN Slug = @identifier THEN 0 ELSE 1 END,
    ID_WebMaquinaria DESC;
`;

export const parseGallery = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value || typeof value !== 'string') {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value);

    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
};

export const normalizeGalleryForStorage = (value) => JSON.stringify(parseGallery(value));

const normalizeMachineTextKey = (value) => String(value ?? '').trim().toLocaleLowerCase('es-AR');

const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  return ['true', '1', 'yes', 'y', 'si', 'sí'].includes(normalizeMachineTextKey(value));
};

const categoryAliases = new Map([
  ['maquinaria nueva', 'Nueva'],
  ['nueva', 'Nueva'],
  ['nuevo', 'Nueva'],
  ['maquinaria usada', 'Usada'],
  ['usada', 'Usada'],
  ['usado', 'Usada'],
  ['trabajos realizados', 'Trabajo Realizado'],
  ['trabajo realizado', 'Trabajo Realizado']
]);

const statusAliases = new Map([
  ['disponible', 'Disponible'],
  ['disponibles', 'Disponible'],
  ['vendida', 'Vendido'],
  ['vendido', 'Vendido'],
  ['vendidas', 'Vendido'],
  ['vendidos', 'Vendido'],
  ['finalizado', 'Vendido'],
  ['finalizada', 'Vendido']
]);

const getLegacyCatalogValue = (value) => categoryAliases.get(normalizeMachineTextKey(value));

const normalizeMachineCategory = (value, machine) => {
  const normalizedCategory = categoryAliases.get(normalizeMachineTextKey(value));

  if (normalizedCategory) {
    return normalizedCategory;
  }

  const legacyStatusCategory = getLegacyCatalogValue(machine?.estado);

  if (legacyStatusCategory) {
    return legacyStatusCategory;
  }

  const normalizedValue = String(value ?? '').trim();

  return statusAliases.has(normalizeMachineTextKey(normalizedValue)) ? '' : normalizedValue;
};

const normalizeMachineStatus = (value, machine) => {
  const normalizedStatus = statusAliases.get(normalizeMachineTextKey(value));

  if (normalizedStatus) {
    return normalizedStatus;
  }

  const legacyCategoryStatus = statusAliases.get(normalizeMachineTextKey(machine?.categoria));

  if (legacyCategoryStatus) {
    return legacyCategoryStatus;
  }

  if (getLegacyCatalogValue(value)) {
    return 'Disponible';
  }

  if (machine?.disponible !== undefined && machine?.disponible !== null && machine?.disponible !== '') {
    return normalizeBoolean(machine.disponible) ? 'Disponible' : 'Vendido';
  }

  return String(value ?? '').trim() || 'Disponible';
};

export const isSoldMachine = (machine) => normalizeMachineStatus(machine?.estado, machine) === 'Vendido';

export const isHistoricalWorkMachine = (machine) => normalizeMachineCategory(machine?.categoria, machine) === 'Trabajo Realizado';

export const isAvailableMachine = (machine) => normalizeMachineStatus(machine?.estado, machine) === 'Disponible';

export const mapMachine = (machine) => ({
  id: machine.id,
  slug: String(machine.slug ?? '').trim() || String(machine.id ?? ''),
  nombre: machine.nombre,
  marca: machine.marca ?? null,
  categoria: normalizeMachineCategory(machine.categoria, machine),
  estado: normalizeMachineStatus(machine.estado, machine),
  descripcionCorta: machine.descripcionCorta ?? null,
  descripcionLarga: machine.descripcionLarga ?? null,
  imagenPrincipal: machine.imagenPrincipal ?? null,
  galeria: parseGallery(machine.galeria),
  disponible: isAvailableMachine(machine),
  activo: Boolean(machine.activo)
});

export const getMachines = async () => {
  const pool = await getSqlPool();
  const result = await pool.request().query(publicMachinesQuery);

  return (result.recordset ?? []).map(mapMachine);
};

const parsePositiveInteger = (value) => {
  if (!/^\d+$/.test(String(value ?? '').trim())) {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
};

export const getMachineBySlug = async (identifier) => {
  const normalizedIdentifier = String(identifier ?? '').trim().slice(0, 150);

  if (!normalizedIdentifier) {
    return null;
  }

  const pool = await getSqlPool();
  const result = await pool
    .request()
    .input('identifier', sql.NVarChar(150), normalizedIdentifier)
    .input('id', sql.Int, parsePositiveInteger(normalizedIdentifier))
    .query(publicMachineByIdentifierQuery);
  const machine = result.recordset?.[0];

  return machine ? mapMachine(machine) : null;
};
