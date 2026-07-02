import { useCallback, useEffect, useRef, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import { apiUrl } from '../../services/sparePartsService.js';
import { applyAdminVisualDataPageOffset, createAdminVisualPoint, deleteAdminVisualPoint, getAdminVisualPoints, saveAdminVisualDataPageConfig, searchAdminVisualManualSpareParts, updateAdminVisualPoint, uploadVisualManualPdf } from '../../services/manualSparePartsSearchService.js';

const manualOptions = [
  { label: 'Repuestos Rastras', value: 'Repuestos Rastras' },
  { label: 'Grano Fino 2019', value: 'Grano Fino 2019' }
];

const normalizeReferenceValue = (value) => String(value ?? '').trim();
const normalizeDuplicateValue = (value) => normalizeReferenceValue(value).toUpperCase();
const getReferenceSortParts = (value) => {
  const text = normalizeReferenceValue(value);
  return /^\d+$/.test(text)
    ? { group: 0, number: Number.parseInt(text, 10), text }
    : { group: 1, number: Number.POSITIVE_INFINITY, text: text.toLocaleUpperCase('es-AR') };
};
const compareReferencesNaturally = (left, right) => {
  const a = getReferenceSortParts(left?.referenciaDespiece ?? left);
  const b = getReferenceSortParts(right?.referenciaDespiece ?? right);
  if (a.group !== b.group) return a.group - b.group;
  if (a.number !== b.number) return a.number - b.number;
  return a.text.localeCompare(b.text, 'es-AR', { numeric: true, sensitivity: 'base' });
};
const getAssistedReferenceScore = (part) => ['codigo', 'descripcion', 'categoria', 'marca', 'modelo', 'paginaImpresa']
  .reduce((score, field) => score + (normalizeReferenceValue(part?.[field]) ? 1 : 0), 0);
const normalizeAssistedReferences = (references = []) => {
  const byReference = new Map();
  for (const part of references || []) {
    const reference = normalizeReferenceValue(part?.referenciaDespiece);
    if (!reference) continue;
    const normalizedPart = { ...part, referenciaDespiece: reference };
    const key = normalizeDuplicateValue(reference);
    const current = byReference.get(key);
    if (!current || getAssistedReferenceScore(normalizedPart) > getAssistedReferenceScore(current)) byReference.set(key, normalizedPart);
  }
  return Array.from(byReference.values()).sort(compareReferencesNaturally);
};
const debugAssistedReferences = ({ rawReferences = [], normalizedReferences = [], usedReferences = new Set() }) => {
  if (!import.meta.env.DEV) return;
  const used = normalizedReferences.filter((part) => usedReferences.has(normalizeDuplicateValue(part.referenciaDespiece))).map((part) => part.referenciaDespiece);
  const pending = normalizedReferences.filter((part) => !usedReferences.has(normalizeDuplicateValue(part.referenciaDespiece))).map((part) => part.referenciaDespiece);
  console.debug('[admin-visual-assisted-references]', {
    rawCount: rawReferences.length,
    rawReferences: rawReferences.map((part) => normalizeReferenceValue(part?.referenciaDespiece)).filter(Boolean),
    normalizedReferences: normalizedReferences.map((part) => part.referenciaDespiece),
    usedReferences: used,
    pendingReferences: pending
  });
};
const clampPercent = (value) => Math.min(Math.max(Number(value), 0), 100);
const emptyManualPointData = {
  codigoManual: '',
  descripcionManual: '',
  categoriaManual: '',
  marcaManual: '',
  modeloManual: '',
  observacionManual: ''
};

const buildDraftPointFromClick = (event, element) => ({
  coords: coordsFromPointer(event, element),
  suggestedReference: '' // Futuro OCR/detección: sugerir referencia más cercana al click.
});

const coordsFromPointer = (event, element) => {
  const rect = element.getBoundingClientRect();
  return {
    xPercent: Number(clampPercent(((event.clientX - rect.left) / rect.width) * 100).toFixed(3)),
    yPercent: Number(clampPercent(((event.clientY - rect.top) / rect.height) * 100).toFixed(3))
  };
};

function AdminVisualSparePartsPage({ currentPath }) {
  const [manualNombre, setManualNombre] = useState(manualOptions[0].value);
  const [pagina, setPagina] = useState('');
  const [referenciaDespiece, setReferenciaDespiece] = useState('');
  const [coords, setCoords] = useState(null);
  const [panel, setPanel] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [moveMode, setMoveMode] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [status, setStatus] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [generatedPages, setGeneratedPages] = useState([]);
  const [lastCreatedPointId, setLastCreatedPointId] = useState(null);
  const [dataPageMode, setDataPageMode] = useState('same');
  const [customDataPage, setCustomDataPage] = useState('');
  const [dataPageStatus, setDataPageStatus] = useState('');
  const [manualLinkSearch, setManualLinkSearch] = useState('');
  const [manualLinkResults, setManualLinkResults] = useState([]);
  const [assistedReferences, setAssistedReferences] = useState([]);
  const [selectedManualLink, setSelectedManualLink] = useState(null);
  const [manualLinkStatus, setManualLinkStatus] = useState('');
  const [manualPointData, setManualPointData] = useState(emptyManualPointData);
  const [continuousMode, setContinuousMode] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(null);
  const referenceInputRef = useRef(null);
  const imageWrapRef = useRef(null);

  const selectedPoint = (panel?.puntos || []).find((point) => point.id === editingId) || null;

  const loadPanel = useCallback(async () => {
    if (!manualNombre || !pagina) return;
    setStatus('Cargando puntos...');
    try {
      const nextPanel = await getAdminVisualPoints({ manualNombre, pagina });
      setPanel(nextPanel);
      const refs = await searchAdminVisualManualSpareParts({ manualNombre, paginaDatos: nextPanel.paginaDatos || pagina, search: '' });
      const normalizedRefs = normalizeAssistedReferences(refs.data || []);
      setAssistedReferences(normalizedRefs);
      debugAssistedReferences({ rawReferences: refs.data || [], normalizedReferences: normalizedRefs, usedReferences: new Set((nextPanel.puntos || []).map((point) => normalizeDuplicateValue(point.referenciaDespiece))) });
      setDataPageMode(nextPanel.dataPageConfig?.mode || 'same');
      setCustomDataPage(String(nextPanel.paginaDatos || pagina));
      setStatus('');
      if (continuousMode) window.requestAnimationFrame(() => selectFirstPendingReference(normalizedRefs, nextPanel.puntos || []));
    } catch (error) {
      setStatus(error.message || 'No se pudieron cargar los puntos.');
    }
  }, [continuousMode, manualNombre, pagina]);

  useEffect(() => { loadPanel(); }, [loadPanel]);

  const focusReferenceInput = () => window.requestAnimationFrame(() => referenceInputRef.current?.focus());

  const resetForm = useCallback(() => {
    setReferenciaDespiece('');
    setCoords(null);
    setEditingId(null);
    setMoveMode(false);
    setDraggingId(null);
    setSelectedManualLink(null);
    setManualLinkSearch('');
    setManualLinkResults([]);
    setManualLinkStatus('');
    setManualPointData(emptyManualPointData);
  }, []);

  const selectPoint = useCallback((point, message = '') => {
    setEditingId(point.id);
    setReferenciaDespiece(point.referenciaDespiece || '');
    setCoords({ xPercent: point.xPercent, yPercent: point.yPercent });
    setSelectedManualLink(point.repuestoManualId ? { id: point.repuestoManualId, codigo: point.codigo, descripcion: point.descripcion, referenciaDespiece: point.referenciaDespiece, categoria: point.categoria, marca: point.marca, modelo: point.modelo } : null);
    setManualPointData({
      codigoManual: point.codigoManual || '',
      descripcionManual: point.descripcionManual || '',
      categoriaManual: point.categoriaManual || '',
      marcaManual: point.marcaManual || '',
      modeloManual: point.modeloManual || '',
      observacionManual: point.observacionManual || ''
    });
    setManualLinkSearch('');
    setManualLinkResults([]);
    setStatus(message || `Punto ${point.referenciaDespiece} seleccionado. Podés editar referencia, moverlo o eliminarlo.`);
    focusReferenceInput();
  }, []);

  const findDuplicatePoint = useCallback((reference) => (panel?.puntos || []).find((point) => (
    point.id !== editingId
    && normalizeDuplicateValue(point.manualNombre || manualNombre) === normalizeDuplicateValue(manualNombre)
    && String(point.pagina || pagina) === String(pagina)
    && normalizeDuplicateValue(point.referenciaDespiece) === normalizeDuplicateValue(reference)
  )), [editingId, manualNombre, pagina, panel?.puntos]);

  const validateForm = () => {
    if (!coords) return 'Hacé clic sobre la imagen para capturar la posición.';
    if (coords.xPercent < 0 || coords.xPercent > 100 || coords.yPercent < 0 || coords.yPercent > 100) return 'Las coordenadas X/Y deben estar dentro de la imagen.';
    if (!referenciaDespiece.trim()) return 'Seleccioná la referencia de despiece.';
    return '';
  };

  const refreshPointInPanel = (point) => {
    setPanel((current) => {
      if (!current) return current;
      const exists = current.puntos.some((item) => item.id === point.id);
      const puntos = exists ? current.puntos.map((item) => (item.id === point.id ? { ...item, ...point } : item)) : [...current.puntos, point];
      return { ...current, puntos: puntos.sort(compareReferencesNaturally) };
    });
  };

  const refreshPointDetails = async () => {
    if (!manualNombre || !pagina) return null;
    const nextPanel = await getAdminVisualPoints({ manualNombre, pagina });
    setPanel(nextPanel);
    setDataPageMode(nextPanel.dataPageConfig?.mode || 'same');
    setCustomDataPage(String(nextPanel.paginaDatos || pagina));
    return nextPanel;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationMessage = validateForm();
    if (validationMessage) { setStatus(validationMessage); focusReferenceInput(); return; }

    const trimmedReference = referenciaDespiece.trim();
    const duplicatePoint = findDuplicatePoint(trimmedReference);
    if (duplicatePoint) {
      selectPoint(duplicatePoint, `La referencia ${trimmedReference} ya tiene un punto asociado.`);
      return;
    }

    const payload = { manualNombre, pagina, referenciaDespiece: trimmedReference, repuestoManualId: selectedManualLink?.id ?? selectedReferencePart?.id ?? null, ...manualPointData, ...coords, activo: true };
    try {
      const savedPoint = editingId ? await updateAdminVisualPoint(editingId, payload) : await createAdminVisualPoint(payload);
      refreshPointInPanel(savedPoint);
      const nextPanel = await refreshPointDetails();
      setLastCreatedPointId(editingId ? null : savedPoint?.id ?? null);
      if (continuousMode && !editingId) {
        const nextUsedReferences = new Set([...(nextPanel?.puntos || []), savedPoint].map((point) => normalizeDuplicateValue(point.referenciaDespiece)));
        const nextReference = findPendingReferenceFrom(trimmedReference, 1, availableReferences, nextUsedReferences);
        setCoords(null);
        setEditingId(null);
        setMoveMode(false);
        setManualPointData(emptyManualPointData);
        setManualLinkSearch('');
        setManualLinkResults([]);
        if (nextReference) {
          applyAssistedReference(nextReference.referenciaDespiece, false);
          setStatus(`Punto ${trimmedReference} guardado. Siguiente referencia pendiente: ${nextReference.referenciaDespiece}.`);
        } else {
          setReferenciaDespiece('');
          setSelectedManualLink(null);
          setStatus(`✅ Página completada. ${totalReferences} / ${totalReferences} referencias.`);
        }
        return;
      }
      selectPoint({ ...savedPoint, codigo: selectedManualLink?.codigo ?? selectedPoint?.codigo, descripcion: selectedManualLink?.descripcion ?? selectedPoint?.descripcion }, editingId ? `Punto ${trimmedReference} actualizado.` : `Punto ${trimmedReference} guardado.`);
    } catch (error) { setStatus(error.message || 'Error al guardar punto'); }
  };

  const handleImageClick = (event) => {
    if (event.target.closest('.visual-panel__marker')) return;
    const draftPoint = buildDraftPointFromClick(event, event.currentTarget);
    const nextCoords = draftPoint.coords;
    setCoords(nextCoords);
    if (draftPoint.suggestedReference) applyAssistedReference(draftPoint.suggestedReference);
    setEditingId(null);
    setMoveMode(false);
    setManualPointData(emptyManualPointData);
    setStatus(continuousMode && referenciaDespiece ? `Referencia ${referenciaDespiece}: posición capturada. Guardá para avanzar a la siguiente pendiente.` : `Nuevo punto en X ${nextCoords.xPercent}% / Y ${nextCoords.yPercent}%. Elegí la referencia asistida y guardá.`);
    focusReferenceInput();
  };

  const handleDelete = useCallback(async (id = editingId) => {
    const point = (panel?.puntos || []).find((item) => item.id === id);
    if (!id || !window.confirm(`¿Eliminar el punto ${point?.referenciaDespiece || id}? Esta acción no se puede deshacer desde el editor.`)) return;
    try {
      await deleteAdminVisualPoint(id);
      setPanel((current) => current ? { ...current, puntos: current.puntos.filter((item) => item.id !== id) } : current);
      await refreshPointDetails();
      if (lastCreatedPointId === id) setLastCreatedPointId(null);
      resetForm();
      setStatus('Punto eliminado.');
    } catch (error) { setStatus(error.message || 'No se pudo eliminar el punto.'); }
  }, [editingId, lastCreatedPointId, panel?.puntos, resetForm]);

  const persistMove = async (point, nextCoords) => {
    const payload = { manualNombre, pagina, referenciaDespiece: point.referenciaDespiece, repuestoManualId: point.repuestoManualId ?? null, codigoManual: point.codigoManual || '', descripcionManual: point.descripcionManual || '', categoriaManual: point.categoriaManual || '', marcaManual: point.marcaManual || '', modeloManual: point.modeloManual || '', observacionManual: point.observacionManual || '', ...nextCoords, activo: true };
    try {
      const savedPoint = await updateAdminVisualPoint(point.id, payload);
      refreshPointInPanel(savedPoint);
      await refreshPointDetails();
      selectPoint(savedPoint, `Punto ${savedPoint.referenciaDespiece} movido a X ${savedPoint.xPercent}% / Y ${savedPoint.yPercent}%.`);
    } catch (error) { setStatus(error.message || 'No se pudo mover el punto.'); }
  };

  const handleMarkerPointerDown = (event, point) => {
    event.preventDefault();
    event.stopPropagation();
    selectPoint(point);
    if (!moveMode) return;
    setDraggingId(point.id);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (continuousMode && referenciaDespiece) setCursorPosition({ x: event.clientX, y: event.clientY });
    if (!draggingId || !imageWrapRef.current) return;
    event.preventDefault();
    const nextCoords = coordsFromPointer(event, imageWrapRef.current);
    setCoords(nextCoords);
    setPanel((current) => current ? { ...current, puntos: current.puntos.map((point) => (point.id === draggingId ? { ...point, ...nextCoords } : point)) } : current);
  };

  const handlePointerUp = (event) => {
    if (!draggingId) return;
    event.preventDefault();
    const point = (panel?.puntos || []).find((item) => item.id === draggingId);
    const nextCoords = imageWrapRef.current ? coordsFromPointer(event, imageWrapRef.current) : coords;
    setDraggingId(null);
    if (point && nextCoords) persistMove(point, nextCoords);
  };

  const handleUndoLastPoint = useCallback(async () => {
    if (!lastCreatedPointId) return;
    await handleDelete(lastCreatedPointId);
  }, [handleDelete, lastCreatedPointId]);

  const usedReferenceSet = new Set((panel?.puntos || []).map((point) => normalizeDuplicateValue(point.referenciaDespiece)));

  const selectFirstPendingReference = (references = assistedReferences, puntos = panel?.puntos || []) => {
    const used = new Set((puntos || []).map((point) => normalizeDuplicateValue(point.referenciaDespiece)));
    const next = (references || []).find((part) => normalizeReferenceValue(part.referenciaDespiece) && !used.has(normalizeDuplicateValue(part.referenciaDespiece)));
    if (next) applyAssistedReference(next.referenciaDespiece, false);
    return next || null;
  };

  const findPendingReferenceFrom = (reference, direction = 1, references = availableReferences, used = usedReferenceSet) => {
    const pending = references.filter((part) => normalizeReferenceValue(part.referenciaDespiece) && !used.has(normalizeDuplicateValue(part.referenciaDespiece)));
    if (!pending.length) return null;
    const currentAvailableIndex = references.findIndex((part) => normalizeDuplicateValue(part.referenciaDespiece) === normalizeDuplicateValue(reference));
    const candidates = direction >= 0
      ? pending.filter((part) => references.findIndex((item) => item.id === part.id) > currentAvailableIndex)
      : pending.filter((part) => references.findIndex((item) => item.id === part.id) < currentAvailableIndex).reverse();
    return candidates[0] || (direction >= 0 ? pending[0] : pending[pending.length - 1]);
  };

  const goToPage = useCallback((delta) => {
    const pageNumber = Number(pagina || 0);
    if (!pageNumber && delta < 0) return;
    const nextPage = Math.max(1, pageNumber + delta);
    setPagina(String(nextPage));
    resetForm();
  }, [pagina, resetForm]);




  const selectedReferencePart = assistedReferences.find((part) => normalizeDuplicateValue(part.referenciaDespiece) === normalizeDuplicateValue(referenciaDespiece)) || null;
  const totalReferences = assistedReferences.length;
  const loadedReferences = assistedReferences.filter((part) => usedReferenceSet.has(normalizeDuplicateValue(part.referenciaDespiece))).length;
  const pendingReferences = Math.max(totalReferences - loadedReferences, 0);
  const progressPercent = totalReferences ? Math.round((loadedReferences / totalReferences) * 100) : 0;
  const availableReferences = assistedReferences.filter((part) => normalizeReferenceValue(part.referenciaDespiece));

  const applyAssistedReference = (reference, announce = true) => {
    const part = assistedReferences.find((item) => normalizeDuplicateValue(item.referenciaDespiece) === normalizeDuplicateValue(reference));
    setReferenciaDespiece(reference || '');
    setSelectedManualLink(part || null);
    setManualPointData(emptyManualPointData);
    if (part && announce) setStatus(`Referencia ${part.referenciaDespiece} seleccionada automáticamente desde RepuestosManuales.`);
  };

  const selectAdjacentReference = (direction) => {
    if (!availableReferences.length) return;
    const nextPending = findPendingReferenceFrom(referenciaDespiece, direction);
    if (nextPending) applyAssistedReference(nextPending.referenciaDespiece);

  };

  useEffect(() => {
    const handleKeyboardShortcut = (event) => {
      const targetTag = event.target?.tagName?.toLowerCase();
      const isTyping = ['input', 'textarea', 'select'].includes(targetTag);
      if (event.key === 'Escape') { event.preventDefault(); resetForm(); setStatus('Edición cancelada.'); return; }
      if (event.key === 'Enter' && !isTyping && (coords || editingId)) { event.preventDefault(); document.querySelector('.admin-visual-editor-form')?.requestSubmit(); return; }
      if (event.key === 'ArrowRight' && !isTyping) { event.preventDefault(); goToPage(1); return; }
      if (event.key === 'ArrowLeft' && !isTyping) { event.preventDefault(); goToPage(-1); return; }
      if (event.key === 'ArrowDown' && !isTyping) { event.preventDefault(); selectAdjacentReference(1); return; }
      if (event.key === 'ArrowUp' && !isTyping) { event.preventDefault(); selectAdjacentReference(-1); return; }
      if (event.key === 'Delete' && editingId) { event.preventDefault(); handleDelete(editingId); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && lastCreatedPointId) { event.preventDefault(); handleUndoLastPoint(); }
    };
    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  }, [coords, editingId, goToPage, handleDelete, handleUndoLastPoint, lastCreatedPointId, resetForm, selectAdjacentReference]);

  const handleSaveDataPageConfig = async (event) => {
    event.preventDefault();
    if (!manualNombre || !pagina) { setDataPageStatus('Cargá manual y página visual.'); return; }
    setDataPageStatus('Guardando página de datos...');
    try {
      const saved = await saveAdminVisualDataPageConfig({ manualNombre, paginaVisual: pagina, mode: dataPageMode, paginaDatos: customDataPage });
      setDataPageStatus(`Página visual ${saved.paginaVisual} usa datos de página ${saved.paginaDatos}.`);
      await loadPanel();
    } catch (error) { setDataPageStatus(error.message || 'No se pudo guardar la página de datos.'); }
  };

  const handleApplyMassiveOffset = async (mode) => {
    if (!manualNombre || !window.confirm(`¿Aplicar a todo ${manualNombre}: ${mode === 'previous' ? 'usar página anterior' : mode === 'next' ? 'usar página siguiente' : 'usar misma página'} como datos?`)) return;
    setDataPageStatus('Aplicando configuración masiva...');
    try {
      const result = await applyAdminVisualDataPageOffset({ manualNombre, mode });
      setDataPageStatus(`Configuración masiva aplicada para ${manualNombre}. Filas afectadas: ${result.affectedRows}.`);
      await loadPanel();
    } catch (error) { setDataPageStatus(error.message || 'No se pudo aplicar la configuración masiva.'); }
  };

  const handleSearchManualLink = async () => {
    const dataPage = panel?.paginaDatos || customDataPage || pagina;
    if (!manualNombre || !dataPage) { setManualLinkStatus('Cargá manual y página de datos antes de buscar.'); return; }
    setManualLinkStatus(manualLinkSearch.trim() ? 'Buscando repuestos en la página de datos y en el mismo manual...' : 'Buscando repuestos de la página de datos...');
    try {
      const response = await searchAdminVisualManualSpareParts({ manualNombre, paginaDatos: dataPage, search: manualLinkSearch });
      setManualLinkResults(response.data || []);
      setManualLinkStatus((response.data || []).length ? `${(response.data || []).length} repuestos encontrados.` : (manualLinkSearch.trim() ? 'No se encontraron repuestos en este manual.' : 'No se encontraron repuestos en esa página.'));
    } catch (error) { setManualLinkStatus(error.message || 'No se pudieron buscar repuestos.'); }
  };

  const handleManualPointDataChange = (field) => (event) => setManualPointData((current) => ({ ...current, [field]: event.target.value }));

  const clearManualPointData = () => setManualPointData(emptyManualPointData);

  const hasManualPointData = Object.values(manualPointData).some((value) => String(value || '').trim());

  const selectedPointHasManualData = selectedPoint ? ['codigoManual', 'descripcionManual', 'categoriaManual', 'marcaManual', 'modeloManual', 'observacionManual'].some((field) => String(selectedPoint[field] || '').trim()) : hasManualPointData;

  const selectedPointBadge = selectedPoint?.repuestoManualId ? 'Vinculado manualmente' : selectedPointHasManualData ? 'Datos manuales' : selectedPoint?.matchSource && selectedPoint.matchSource !== 'none' ? 'Cruce automático' : '';

  const dataPageLabel = panel?.paginaDatos || customDataPage || pagina || '-';

  const formatManualLink = (part) => `Código ${part.codigo || 'Sin código'} — Página ${part.pagina || part.paginaImpresa || '-'} — ${part.descripcion || 'Sin descripción'}`;

  const handlePdfUpload = async (event) => {
    event.preventDefault();
    if (!manualNombre) { setUploadStatus('Ingresá el nombre del manual.'); return; }
    if (!pdfFile) { setUploadStatus('Seleccioná un archivo PDF.'); return; }
    setUploadStatus('Procesando páginas...');
    try {
      const result = await uploadVisualManualPdf({ manualNombre, archivo: pdfFile });
      setGeneratedPages(result.paginas || []);
      setUploadStatus(`${result.paginasGeneradas || 0} páginas generadas.`);
      if (result.paginas?.[0]) {
        setPagina(String(result.paginas[0].pagina));
        setPanel({ manualNombre, pagina: result.paginas[0].pagina, imageUrl: result.paginas[0].imageUrl, puntos: [] });
      }
    } catch (error) { setUploadStatus(error.message || 'No se pudo procesar el PDF.'); }
  };

  return (
    <AdminLayout currentPath={currentPath}>
      <section className="admin-section admin-visual-page">
        <div className="admin-visual-header-card">
          <div className="admin-visual-header-card__title">
            <p className="admin-topbar__eyebrow">Repuestos</p>
            <h1>Repuestos visuales</h1>
            <p>Administrá la imagen del despiece, sus puntos interactivos y la prioridad de datos que verá el buscador visual.</p>
          </div>
          <div className="admin-visual-header-card__controls" aria-label="Carga de imagen y puntos">
            <label>Manual
              <select value={manualNombre} onChange={(event) => setManualNombre(event.target.value)}>
                {manualOptions.map((manual) => <option key={manual.value} value={manual.value}>{manual.label}</option>)}
                {manualNombre && !manualOptions.some((manual) => manual.value === manualNombre) ? <option value={manualNombre}>{manualNombre}</option> : null}
              </select>
            </label>
            <label>Página
              <input type="number" min="1" value={pagina} onChange={(event) => setPagina(event.target.value)} />
            </label>
            <button type="button" className="button" onClick={loadPanel}>Cargar imagen y puntos</button><label className="admin-visual-continuous-toggle"><input type="checkbox" checked={continuousMode} onChange={(event) => { setContinuousMode(event.target.checked); if (event.target.checked) selectFirstPendingReference(); }} /> Carga continua</label>
          </div>
        </div>

        <details className="admin-visual-upload-card">
          <summary>Cargar imágenes desde PDF</summary>
          <form className="admin-visual-upload-form" onSubmit={handlePdfUpload}>
            <label>ManualNombre<input value={manualNombre} onChange={(event) => setManualNombre(event.target.value)} placeholder="Ej.: Repuestos Rastras" /></label>
            <label>Archivo PDF<input type="file" accept="application/pdf" onChange={(event) => setPdfFile(event.target.files?.[0] || null)} /></label>
            <button className="button button--secondary" type="submit">Generar imágenes</button>
            {uploadStatus ? <p className="status-message">{uploadStatus}</p> : null}
            {generatedPages.length ? <label>Página generada<select value={pagina} onChange={(event) => { setPagina(event.target.value); const selected = generatedPages.find((page) => String(page.pagina) === event.target.value); if (selected) setPanel({ manualNombre, pagina: selected.pagina, imageUrl: selected.imageUrl, puntos: [] }); }}>{generatedPages.map((page) => <option key={page.pagina} value={page.pagina}>Página {page.pagina} - {page.imageUrl}</option>)}</select></label> : null}
          </form>
        </details>

        {status ? <p className="status-message">{status}</p> : null}

        {panel ? <section className="admin-visual-assisted-progress" aria-label="Resumen de carga continua">
          <div className="admin-visual-progress-card__header"><div><p className="admin-topbar__eyebrow">Resumen de página</p><strong>Página {pagina || '-'}</strong></div><span>{progressPercent}%</span></div>
          <div className="admin-visual-progress-stats"><span>Total referencias:<strong>{totalReferences}</strong></span><span>Cargadas:<strong>{loadedReferences}</strong></span><span>Pendientes:<strong>{pendingReferences}</strong></span><span>Progreso:<strong>{progressPercent}%</strong></span></div>
          <progress max="100" value={progressPercent}>{progressPercent}%</progress>
          {totalReferences > 0 && pendingReferences === 0 ? <div className="admin-visual-completed"><strong>✅ Página completada</strong><span>{loadedReferences} / {totalReferences} referencias</span><button type="button" className="button" onClick={() => goToPage(1)}>Ir a la siguiente página</button></div> : null}
        </section> : null}

        <div className="admin-visual-layout">
          <div className="admin-visual-canvas-column">
            <section className="admin-visual-card admin-visual-canvas-card" aria-labelledby="admin-visual-canvas-title">
              <div className="admin-visual-card__header">
                <div>
                  <p className="admin-topbar__eyebrow">Imagen del despiece</p>
                  <h2 id="admin-visual-canvas-title">Página {pagina || '-'}</h2>
                </div>
              </div>
              <div className="admin-visual-image-viewport">
                <div ref={imageWrapRef} className={`visual-panel__image-stage admin-visual-image-stage${moveMode ? ' visual-panel__image-wrap--dragging' : ''}`} onClick={handleImageClick} onPointerMove={handlePointerMove} onPointerLeave={() => setCursorPosition(null)} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} role="button" tabIndex="0">
                  {panel?.imageUrl ? <img src={`${apiUrl}${panel.imageUrl}`} alt={`Manual ${manualNombre} página ${pagina}`} draggable="false" /> : <p className="status-message manual-spare-parts-empty">No hay imagen cargada para esta página.</p>}
                  {(panel?.puntos || []).map((point) => <button type="button" key={point.id} className={`visual-panel__marker visual-panel__marker--loaded${editingId === point.id ? ' visual-panel__marker--selected' : ''}`} title={`Referencia ${point.referenciaDespiece} · Código ${point.codigo || point.codigoManual || '-'} · ${point.descripcion || point.descripcionManual || 'Sin descripción'}`} onPointerDown={(event) => handleMarkerPointerDown(event, point)} style={{ left: `${point.xPercent}%`, top: `${point.yPercent}%` }}>{point.referenciaDespiece}<small>Ref. {point.referenciaDespiece}<br />Código: {point.codigo || point.codigoManual || '-'}<br />{point.descripcion || point.descripcionManual || 'Sin descripción'}</small></button>)}
                  {continuousMode && referenciaDespiece && cursorPosition ? <span className="admin-visual-cursor-badge" style={{ left: cursorPosition.x + 14, top: cursorPosition.y + 14 }}>Colocando:<strong>{referenciaDespiece}</strong></span> : null}
                  {coords && !editingId ? <span className="visual-panel__marker visual-panel__marker--draft admin-visual-marker--new" style={{ left: `${coords.xPercent}%`, top: `${coords.yPercent}%` }}>{referenciaDespiece || '+'}</span> : null}
                </div>
              </div>
              <p className="admin-visual-shortcuts">Click en punto → seleccionar. Click en imagen → crear. Enter guarda. Escape cancela. Delete elimina seleccionado. Ctrl+Z deshace el último punto nuevo.</p>
            </section>

            <section className="admin-visual-card" aria-labelledby="admin-visual-points-title">
              <div className="admin-visual-card__header">
                <h2 id="admin-visual-points-title">Puntos de la página</h2>
                <button className="button button--secondary" type="button" onClick={handleUndoLastPoint} disabled={!lastCreatedPointId}>Deshacer último punto</button>
              </div>
              <div className="manual-spare-parts-table-wrapper admin-visual-table-wrapper">
                <table className="manual-spare-parts-table admin-visual-points-table"><thead><tr><th>Ref.</th><th>X%</th><th>Y%</th><th>Código</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{(panel?.puntos || []).map((point) => <tr key={point.id} className={editingId === point.id ? 'is-selected' : ''}><td>{point.referenciaDespiece}</td><td>{point.xPercent}</td><td>{point.yPercent}</td><td>{point.codigo || point.codigoManual || '-'}</td><td>{point.repuestoManualId ? 'Vinculado manualmente' : point.codigoManual || point.descripcionManual ? 'Datos manuales' : point.matchSource || 'Inferencia por orden'}</td><td><button type="button" onClick={() => selectPoint(point)}>Editar</button> <button type="button" onClick={() => handleDelete(point.id)}>Eliminar</button></td></tr>)}</tbody></table>
              </div>
            </section>
          </div>

          <aside className="admin-visual-editor-panel" aria-label="Editor del punto seleccionado">
            <section className="admin-visual-card admin-visual-reference-panel"><div className="admin-visual-card__header"><h3>Referencias · Página {pagina || '-'}</h3></div><div className="admin-visual-reference-list">{availableReferences.map((part) => { const used = usedReferenceSet.has(normalizeDuplicateValue(part.referenciaDespiece)); const current = normalizeDuplicateValue(part.referenciaDespiece) === normalizeDuplicateValue(referenciaDespiece); return <button type="button" key={part.id} className={`${used ? 'is-used' : 'is-pending'}${current ? ' is-current' : ''}`} onClick={() => applyAssistedReference(part.referenciaDespiece)}>{current ? '▶' : used ? '✔' : '○'} {part.referenciaDespiece}</button>; })}</div></section>
            <form className="admin-visual-editor-form" onSubmit={handleSubmit}>
              <section className="admin-visual-card admin-visual-editor-heading">
                {editingId || coords ? <>
                  <p className="admin-topbar__eyebrow">{editingId ? `Editando referencia ${referenciaDespiece || '-'}` : 'Nuevo punto'}</p>
                  <h2>{editingId ? `Editando referencia ${referenciaDespiece || '-'}` : 'Posición capturada'}</h2>
                  <div className="admin-visual-badges">
                    {selectedPointBadge ? <span className="admin-visual-quick-badge">{selectedPointBadge}</span> : null}
                    {coords ? <span className="admin-visual-quick-badge admin-visual-quick-badge--muted">Posición capturada</span> : <span className="admin-visual-quick-badge admin-visual-quick-badge--warning">Sin capturar</span>}
                  </div>
                </> : <p className="admin-visual-empty-editor">Hacé clic en la imagen o seleccioná un punto para editarlo.</p>}
              </section>

              <section className="admin-visual-card">
                <div className="admin-visual-card__header"><h3>{referenciaDespiece ? `Referencia ${referenciaDespiece}` : 'Datos básicos del punto'}</h3></div>
                <div className="admin-visual-fields-grid">
                  <label>Referencia<select ref={referenceInputRef} value={referenciaDespiece} onChange={(event) => applyAssistedReference(event.target.value)}><option value="">Seleccionar referencia</option>{availableReferences.map((part) => { const used = usedReferenceSet.has(normalizeDuplicateValue(part.referenciaDespiece)); return <option key={part.id} value={part.referenciaDespiece} disabled={used && normalizeDuplicateValue(part.referenciaDespiece) !== normalizeDuplicateValue(referenciaDespiece)}>{used ? '✔' : '○'} {part.referenciaDespiece}</option>; })}</select></label>
                  <label>Posición X<input value={coords?.xPercent ?? ''} readOnly placeholder="Sin capturar" /></label>
                  <label>Posición Y<input value={coords?.yPercent ?? ''} readOnly placeholder="Sin capturar" /></label>
                </div>
                <div className="admin-visual-assisted-detail"><p><strong>Código:</strong> {selectedReferencePart?.codigo || selectedManualLink?.codigo || '-'}</p><p><strong>Descripción:</strong> {selectedReferencePart?.descripcion || selectedManualLink?.descripcion || '-'}</p></div>
                <p className="admin-visual-selection">Estado: {coords ? 'posición capturada' : 'sin capturar'}</p>
                <div className="admin-visual-actions">
                  <button className="button button--secondary" type="button" onClick={() => selectAdjacentReference(-1)}>Referencia anterior</button>
                  <button className="button button--secondary" type="button" onClick={() => selectAdjacentReference(1)}>Referencia siguiente</button>
                  <button className="button" type="submit">{editingId ? 'Guardar cambios' : 'Guardar punto'}</button>
                  {editingId ? <button className="button button--secondary" type="button" onClick={() => setMoveMode((value) => !value)}>{moveMode ? 'Desactivar mover punto' : 'Mover punto'}</button> : null}
                  <button className="button button--secondary" type="button" onClick={resetForm}>Cancelar</button>
                  {editingId ? <button className="button button--danger" type="button" onClick={() => handleDelete(editingId)}>Eliminar punto</button> : null}
                </div>
              </section>

              <section className="admin-visual-card">
                <div className="admin-visual-card__header"><h3>Vincular repuesto manual</h3></div>
                <p className="admin-visual-shortcuts">Buscá por código o descripción. Página de datos actual: {dataPageLabel}.</p>
                {selectedManualLink ? <div className="admin-visual-linked-part"><span>Repuesto vinculado actual</span><strong>{formatManualLink(selectedManualLink)}</strong><button type="button" className="button button--secondary" onClick={() => setSelectedManualLink(null)}>Desvincular</button></div> : <p className="admin-visual-selection">Sin vínculo manual. Se usará cruce automático o inferencia.</p>}
                <div className="admin-visual-search-row">
                  <label>Buscar repuesto<input value={manualLinkSearch} onChange={(event) => setManualLinkSearch(event.target.value)} placeholder="Código o descripción" /></label>
                  <button className="button button--secondary" type="button" onClick={handleSearchManualLink}>Buscar</button>
                </div>
                {manualLinkStatus ? <p className="status-message">{manualLinkStatus}</p> : null}
                {manualLinkResults.length ? <div className="manual-spare-parts-table-wrapper admin-visual-table-wrapper"><table className="manual-spare-parts-table admin-visual-results-table"><thead><tr><th>Repuesto</th><th>Ref.</th><th>Página</th><th>Acción</th></tr></thead><tbody>{manualLinkResults.map((part) => <tr key={part.id}><td>{formatManualLink(part)}</td><td>{part.referenciaDespiece || '-'}</td><td>{part.paginaImpresa || '-'}</td><td><button type="button" onClick={() => setSelectedManualLink(part)}>Seleccionar</button></td></tr>)}</tbody></table></div> : null}
              </section>

              <section className="admin-visual-card">
                <div className="admin-visual-card__header"><h3>Datos manuales personalizados</h3></div>
                <p className="admin-visual-shortcuts">Se usan cuando no hay repuesto vinculado. El vínculo manual siempre tiene prioridad.</p>
                <div className="admin-visual-fields-grid">
                  <label>Código<input value={manualPointData.codigoManual} onChange={handleManualPointDataChange('codigoManual')} placeholder="Ej.: CXXXX" /></label>
                  <label>Descripción<input value={manualPointData.descripcionManual} onChange={handleManualPointDataChange('descripcionManual')} placeholder="Ej.: Pieza especial" /></label>
                  <label>Categoría<input value={manualPointData.categoriaManual} onChange={handleManualPointDataChange('categoriaManual')} placeholder="Ej.: Manual" /></label>
                  <label>Marca<input value={manualPointData.marcaManual} onChange={handleManualPointDataChange('marcaManual')} /></label>
                  <label>Modelo<input value={manualPointData.modeloManual} onChange={handleManualPointDataChange('modeloManual')} /></label>
                  <label>Observación<input value={manualPointData.observacionManual} onChange={handleManualPointDataChange('observacionManual')} /></label>
                </div>
                <button className="button button--secondary" type="button" onClick={clearManualPointData}>Limpiar datos manuales</button>
              </section>
            </form>

            <section className="admin-visual-card admin-visual-priority-card">
              <h3>Prioridad de datos</h3>
              <ol>
                <li>Repuesto vinculado</li>
                <li>Datos manuales</li>
                <li>Cruce automático</li>
                <li>Inferencia por orden</li>
              </ol>
            </section>

            <form className="admin-visual-card admin-visual-data-page-card" onSubmit={handleSaveDataPageConfig}>
              <h3>Datos de esta imagen</h3>
              <p className="admin-visual-shortcuts">La imagen usa la página visual {pagina || '-'}, pero los códigos/descripciones pueden leerse desde otra página.</p>
              <label>Página de datos
                <select value={dataPageMode} onChange={(event) => setDataPageMode(event.target.value)}>
                  <option value="same">Usar misma página</option>
                  <option value="previous">Usar página anterior como página de datos</option>
                  <option value="next">Usar página siguiente como página de datos</option>
                  <option value="custom">Página personalizada</option>
                </select>
              </label>
              {dataPageMode === 'custom' ? <label>Página personalizada<input type="number" min="1" value={customDataPage} onChange={(event) => setCustomDataPage(event.target.value)} placeholder="Ej.: 8" /></label> : null}
              <div className="admin-visual-actions">
                <button className="button" type="submit">Guardar datos</button>
                <button className="button button--secondary" type="button" onClick={() => handleApplyMassiveOffset('previous')}>Todo: página anterior</button>
                <button className="button button--secondary" type="button" onClick={() => handleApplyMassiveOffset('same')}>Todo: misma página</button>
                <button className="button button--secondary" type="button" onClick={() => handleApplyMassiveOffset('next')}>Todo: página siguiente</button>
              </div>
              {panel?.paginaDatos ? <p className="admin-visual-selection">Configuración activa: página visual {panel.paginaVisual || panel.pagina} usa datos de página {panel.paginaDatos}.</p> : null}
              {dataPageStatus ? <p className="status-message">{dataPageStatus}</p> : null}
            </form>
          </aside>
        </div>
      </section>
    </AdminLayout>
  );
}

export default AdminVisualSparePartsPage;
