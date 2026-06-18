import { getSqlPool, sql } from '../config/sqlServer.js';
import { isAvailableMachine, mapMachine, normalizeGalleryForStorage } from './machinesService.js';

class MachineValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MachineValidationError';
  }
}

export { MachineValidationError };

const machineFieldsSelect = `
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
`;

const allMachinesQuery = `
SELECT${machineFieldsSelect}
FROM dbo.WebMaquinarias
ORDER BY FechaAlta DESC, ID_WebMaquinaria DESC;
`;

const machineByIdQuery = `
SELECT TOP (1)${machineFieldsSelect}
FROM dbo.WebMaquinarias
WHERE ID_WebMaquinaria = @id;
`;

const createMachineQuery = `
INSERT INTO dbo.WebMaquinarias (
    Slug,
    Nombre,
    Marca,
    Categoria,
    Estado,
    DescripcionCorta,
    DescripcionLarga,
    ImagenPrincipal,
    Galeria,
    Disponible,
    Activo
)
OUTPUT
    INSERTED.ID_WebMaquinaria AS id,
    INSERTED.Slug AS slug,
    INSERTED.Nombre AS nombre,
    INSERTED.Marca AS marca,
    INSERTED.Categoria AS categoria,
    INSERTED.Estado AS estado,
    INSERTED.DescripcionCorta AS descripcionCorta,
    INSERTED.DescripcionLarga AS descripcionLarga,
    INSERTED.ImagenPrincipal AS imagenPrincipal,
    INSERTED.Galeria AS galeria,
    INSERTED.Disponible AS disponible,
    INSERTED.Activo AS activo
VALUES (
    @slug,
    @nombre,
    @marca,
    @categoria,
    @estado,
    @descripcionCorta,
    @descripcionLarga,
    @imagenPrincipal,
    @galeria,
    @disponible,
    @activo
);
`;

const updateMachineQuery = `
UPDATE dbo.WebMaquinarias
SET
    Slug = @slug,
    Nombre = @nombre,
    Marca = @marca,
    Categoria = @categoria,
    Estado = @estado,
    DescripcionCorta = @descripcionCorta,
    DescripcionLarga = @descripcionLarga,
    ImagenPrincipal = @imagenPrincipal,
    Galeria = @galeria,
    Disponible = @disponible,
    Activo = @activo,
    FechaModificacion = GETDATE()
OUTPUT
    INSERTED.ID_WebMaquinaria AS id,
    INSERTED.Slug AS slug,
    INSERTED.Nombre AS nombre,
    INSERTED.Marca AS marca,
    INSERTED.Categoria AS categoria,
    INSERTED.Estado AS estado,
    INSERTED.DescripcionCorta AS descripcionCorta,
    INSERTED.DescripcionLarga AS descripcionLarga,
    INSERTED.ImagenPrincipal AS imagenPrincipal,
    INSERTED.Galeria AS galeria,
    INSERTED.Disponible AS disponible,
    INSERTED.Activo AS activo
WHERE ID_WebMaquinaria = @id;
`;

const softDeleteMachineQuery = `
UPDATE dbo.WebMaquinarias
SET
    Activo = 0,
    FechaModificacion = GETDATE()
OUTPUT
    INSERTED.ID_WebMaquinaria AS id,
    INSERTED.Slug AS slug,
    INSERTED.Nombre AS nombre,
    INSERTED.Marca AS marca,
    INSERTED.Categoria AS categoria,
    INSERTED.Estado AS estado,
    INSERTED.DescripcionCorta AS descripcionCorta,
    INSERTED.DescripcionLarga AS descripcionLarga,
    INSERTED.ImagenPrincipal AS imagenPrincipal,
    INSERTED.Galeria AS galeria,
    INSERTED.Disponible AS disponible,
    INSERTED.Activo AS activo
WHERE ID_WebMaquinaria = @id;
`;

const parsePositiveInteger = (value) => {
  const parsedValue = Number.parseInt(value, 10);

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
};

const normalizeText = (value, maxLength) => {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim().slice(0, maxLength);
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
  ['vendida', 'Vendido'],
  ['vendido', 'Vendido'],
  ['finalizado', 'Vendido'],
  ['finalizada', 'Vendido'],
  ['vendidas', 'Vendido'],
  ['vendidos', 'Vendido']
]);

const normalizeCatalogValue = (value, maxLength, aliases) => {
  const normalizedValue = normalizeText(value, maxLength);

  return aliases.get(normalizedValue.toLocaleLowerCase('es-AR')) ?? normalizedValue;
};

const normalizeNullableText = (value, maxLength) => {
  const normalizedValue = normalizeText(value, maxLength);

  return normalizedValue || null;
};

export const createSlugFromName = (name) => String(name ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 150);

const normalizeBoolean = (value, defaultValue) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  return ['true', '1', 'yes', 'y', 'si', 'sí'].includes(String(value).trim().toLowerCase());
};

const allowedCategories = new Set(['Nueva', 'Usada', 'Trabajo Realizado']);
const allowedStatuses = new Set(['Disponible', 'Vendido']);

const normalizeMachineStatusPayload = (value) => {
  const normalizedValue = normalizeText(value, 100);
  const normalizedKey = normalizedValue.toLocaleLowerCase('es-AR');

  if (statusAliases.has(normalizedKey)) {
    return statusAliases.get(normalizedKey);
  }

  if (categoryAliases.has(normalizedKey)) {
    return 'Disponible';
  }

  return normalizedValue;
};

const normalizeMachinePayload = (payload) => {
  const nombre = normalizeText(payload?.nombre, 200);
  const categoria = normalizeCatalogValue(payload?.categoria, 100, categoryAliases);
  const estado = normalizeMachineStatusPayload(payload?.estado);
  const slugSource = normalizeText(payload?.slug, 150) || nombre;
  const slug = createSlugFromName(slugSource);

  if (!nombre) {
    throw new MachineValidationError('El nombre es requerido.');
  }

  if (!categoria) {
    throw new MachineValidationError('La categoría es requerida.');
  }

  if (!allowedCategories.has(categoria)) {
    throw new MachineValidationError('La categoría debe ser Nueva, Usada o Trabajo Realizado.');
  }

  if (!estado) {
    throw new MachineValidationError('El estado es requerido.');
  }

  if (!allowedStatuses.has(estado)) {
    throw new MachineValidationError('El estado debe ser Disponible o Vendido.');
  }

  if (!slug) {
    throw new MachineValidationError('El slug es requerido.');
  }

  return {
    slug,
    nombre,
    marca: normalizeNullableText(payload?.marca, 100),
    categoria,
    estado,
    descripcionCorta: normalizeNullableText(payload?.descripcionCorta, 500),
    descripcionLarga: payload?.descripcionLarga ? String(payload.descripcionLarga).trim() || null : null,
    imagenPrincipal: normalizeNullableText(payload?.imagenPrincipal, 500),
    galeria: normalizeGalleryForStorage(payload?.galeria),
    disponible: isAvailableMachine({ categoria, estado, disponible: estado === 'Disponible' }),
    activo: normalizeBoolean(payload?.activo, true)
  };
};

const addMachineInputs = (request, machine) => {
  request.input('slug', sql.NVarChar(150), machine.slug);
  request.input('nombre', sql.NVarChar(200), machine.nombre);
  request.input('marca', sql.NVarChar(100), machine.marca);
  request.input('categoria', sql.NVarChar(100), machine.categoria);
  request.input('estado', sql.NVarChar(100), machine.estado);
  request.input('descripcionCorta', sql.NVarChar(500), machine.descripcionCorta);
  request.input('descripcionLarga', sql.NVarChar(sql.MAX), machine.descripcionLarga);
  request.input('imagenPrincipal', sql.NVarChar(500), machine.imagenPrincipal);
  request.input('galeria', sql.NVarChar(sql.MAX), machine.galeria);
  request.input('disponible', sql.Bit, machine.disponible);
  request.input('activo', sql.Bit, machine.activo);

  return request;
};

export const getAdminMachines = async () => {
  const pool = await getSqlPool();
  const result = await pool.request().query(allMachinesQuery);

  return (result.recordset ?? []).map(mapMachine);
};

export const getAdminMachineById = async (id) => {
  const machineId = parsePositiveInteger(id);

  if (!machineId) {
    return null;
  }

  const pool = await getSqlPool();
  const result = await pool.request().input('id', sql.Int, machineId).query(machineByIdQuery);
  const machine = result.recordset?.[0];

  return machine ? mapMachine(machine) : null;
};

export const createAdminMachine = async (payload) => {
  const machine = normalizeMachinePayload(payload);
  const pool = await getSqlPool();
  const result = await addMachineInputs(pool.request(), machine).query(createMachineQuery);

  return mapMachine(result.recordset[0]);
};

export const updateAdminMachine = async (id, payload) => {
  const machineId = parsePositiveInteger(id);

  if (!machineId) {
    return null;
  }

  const currentMachine = await getAdminMachineById(machineId);

  if (!currentMachine) {
    return null;
  }

  const machine = normalizeMachinePayload({
    ...currentMachine,
    ...payload,
    nombre: payload?.nombre ?? currentMachine.nombre,
    slug: payload?.slug ?? currentMachine.slug,
    marca: payload?.marca ?? currentMachine.marca,
    categoria: payload?.categoria ?? currentMachine.categoria,
    estado: payload?.estado ?? currentMachine.estado,
    descripcionCorta: payload?.descripcionCorta ?? currentMachine.descripcionCorta,
    descripcionLarga: payload?.descripcionLarga ?? currentMachine.descripcionLarga,
    imagenPrincipal: payload?.imagenPrincipal ?? currentMachine.imagenPrincipal,
    galeria: payload?.galeria ?? currentMachine.galeria,
    activo: payload?.activo ?? currentMachine.activo
  });
  const pool = await getSqlPool();
  const result = await addMachineInputs(pool.request(), machine)
    .input('id', sql.Int, machineId)
    .query(updateMachineQuery);
  const updatedMachine = result.recordset?.[0];

  return updatedMachine ? mapMachine(updatedMachine) : null;
};

export const softDeleteAdminMachine = async (id) => {
  const machineId = parsePositiveInteger(id);

  if (!machineId) {
    return null;
  }

  const pool = await getSqlPool();
  const result = await pool.request().input('id', sql.Int, machineId).query(softDeleteMachineQuery);
  const deletedMachine = result.recordset?.[0];

  return deletedMachine ? mapMachine(deletedMachine) : null;
};
