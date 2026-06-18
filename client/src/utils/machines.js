export const machineCategories = ['Nueva', 'Usada', 'Trabajo Realizado'];
export const machineStatuses = ['Disponible', 'Vendido'];

const workCategory = 'Trabajo Realizado';
const soldStatus = 'Vendido';
const availableStatus = 'Disponible';

const categoryAliases = new Map([
  ['maquinaria nueva', 'Nueva'],
  ['nueva', 'Nueva'],
  ['nuevo', 'Nueva'],
  ['maquinaria usada', 'Usada'],
  ['usada', 'Usada'],
  ['usado', 'Usada'],
  ['trabajos realizados', workCategory],
  ['trabajo realizado', workCategory]
]);

const statusAliases = new Map([
  ['disponible', availableStatus],
  ['disponibles', availableStatus],
  ['vendida', soldStatus],
  ['vendido', soldStatus],
  ['vendidas', soldStatus],
  ['vendidos', soldStatus],
  ['finalizado', soldStatus],
  ['finalizada', soldStatus]
]);

function normalizeKey(value) {
  return String(value ?? '').trim().toLocaleLowerCase('es-AR');
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  return ['true', '1', 'yes', 'y', 'si', 'sí'].includes(normalizeKey(value));
}

function getLegacyCatalogValue(value) {
  return categoryAliases.get(normalizeKey(value));
}

export function normalizeMachineCategory(value, machine) {
  const normalizedCategory = categoryAliases.get(normalizeKey(value));

  if (normalizedCategory) {
    return normalizedCategory;
  }

  const legacyStatusCategory = getLegacyCatalogValue(machine?.estado);

  if (legacyStatusCategory) {
    return legacyStatusCategory;
  }

  const normalizedValue = String(value ?? '').trim();

  return statusAliases.has(normalizeKey(normalizedValue)) ? '' : normalizedValue;
}

export function normalizeMachineStatus(value, machine) {
  const normalizedStatus = statusAliases.get(normalizeKey(value));

  if (normalizedStatus) {
    return normalizedStatus;
  }

  const legacyCategoryStatus = statusAliases.get(normalizeKey(machine?.categoria));

  if (legacyCategoryStatus) {
    return legacyCategoryStatus;
  }

  const categoryValue = getLegacyCatalogValue(value);

  if (categoryValue) {
    return availableStatus;
  }

  if (machine?.disponible !== undefined && machine?.disponible !== null && machine?.disponible !== '') {
    return normalizeBoolean(machine.disponible) ? availableStatus : soldStatus;
  }

  return String(value ?? '').trim() || availableStatus;
}

export function getMachineCategory(machine) {
  return normalizeMachineCategory(machine?.categoria, machine);
}

export function getMachineStatus(machine) {
  return normalizeMachineStatus(machine?.estado, machine);
}

export function getMachineSlug(machine) {
  return String(machine?.slug ?? '').trim() || machine?.id;
}

export function isSoldMachine(machine) {
  return getMachineStatus(machine) === soldStatus;
}

export function isHistoricalWorkMachine(machine) {
  return getMachineCategory(machine) === workCategory;
}

export function isAvailableMachine(machine) {
  return getMachineStatus(machine) === availableStatus;
}

export function sortMachinesByAvailability(machines) {
  return [...machines].sort((firstMachine, secondMachine) => {
    const firstAvailabilityOrder = isSoldMachine(firstMachine) ? 1 : 0;
    const secondAvailabilityOrder = isSoldMachine(secondMachine) ? 1 : 0;

    return firstAvailabilityOrder - secondAvailabilityOrder;
  });
}

export function getMachineAvailabilityLabel(machine, unavailableLabel = 'Vendido') {
  return isAvailableMachine(machine) ? availableStatus : unavailableLabel;
}

export function getMachineBadges(machine) {
  return [
    { label: getMachineCategory(machine), type: 'category' },
    { label: getMachineStatus(machine), type: 'status' }
  ].filter((badge) => badge.label);
}
