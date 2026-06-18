export const contactSelectedPartsStorageKey = 'contactSelectedParts';

function normalizeSelectedPart(sparePart) {
  return {
    id: sparePart?.id ?? '',
    nombre: sparePart?.nombre ?? '',
    codigo: sparePart?.codigo ?? '',
    manual: sparePart?.manual ?? '',
    pagina: sparePart?.pagina ?? '',
    categoria: sparePart?.categoria ?? '',
    source: sparePart?.source ?? 'catalog'
  };
}

function hasStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function getContactSelectedParts() {
  if (!hasStorage()) {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(contactSelectedPartsStorageKey);
    const parsedValue = storedValue ? JSON.parse(storedValue) : [];

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .filter((sparePart) => sparePart && sparePart.id !== undefined && sparePart.id !== null)
      .map(normalizeSelectedPart);
  } catch {
    return [];
  }
}

export function saveContactSelectedParts(spareParts) {
  if (!hasStorage()) {
    return [];
  }

  const normalizedParts = Array.isArray(spareParts) ? spareParts.map(normalizeSelectedPart) : [];
  window.localStorage.setItem(contactSelectedPartsStorageKey, JSON.stringify(normalizedParts));

  return normalizedParts;
}

export function addContactSelectedPart(sparePart) {
  const selectedParts = getContactSelectedParts();
  const normalizedPart = normalizeSelectedPart(sparePart);
  const alreadySelected = selectedParts.some(
    (selectedPart) => String(selectedPart.id) === String(normalizedPart.id)
  );

  if (alreadySelected) {
    return {
      selectedParts,
      wasAdded: false
    };
  }

  const updatedParts = saveContactSelectedParts([...selectedParts, normalizedPart]);

  return {
    selectedParts: updatedParts,
    wasAdded: true
  };
}

export function removeContactSelectedPart(partId) {
  const updatedParts = getContactSelectedParts().filter(
    (selectedPart) => String(selectedPart.id) !== String(partId)
  );

  return saveContactSelectedParts(updatedParts);
}

export function clearContactSelectedParts() {
  if (hasStorage()) {
    window.localStorage.removeItem(contactSelectedPartsStorageKey);
  }

  return [];
}
