import { useCallback, useEffect, useRef, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import { apiUrl } from '../../services/sparePartsService.js';
import { applyAdminVisualDataPageOffset, createAdminVisualPoint, deleteAdminVisualPoint, getAdminVisualPoints, saveAdminVisualDataPageConfig, searchAdminVisualManualSpareParts, updateAdminVisualPoint, uploadVisualManualPdf } from '../../services/manualSparePartsSearchService.js';

const manualOptions = [
  { label: 'Repuestos Rastras', value: 'Repuestos Rastras' },
  { label: 'Grano Fino 2019', value: 'Grano Fino 2019' }
];

const normalizeDuplicateValue = (value) => String(value ?? '').trim().toUpperCase();
const clampPercent = (value) => Math.min(Math.max(Number(value), 0), 100);
const emptyManualPointData = {
  codigoManual: '',
  descripcionManual: '',
  categoriaManual: '',
  marcaManual: '',
  modeloManual: '',
  observacionManual: ''
};

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
  const [selectedManualLink, setSelectedManualLink] = useState(null);
  const [manualLinkStatus, setManualLinkStatus] = useState('');
  const [manualPointData, setManualPointData] = useState(emptyManualPointData);
  const referenceInputRef = useRef(null);
  const imageWrapRef = useRef(null);

  const selectedPoint = (panel?.puntos || []).find((point) => point.id === editingId) || null;

  const loadPanel = useCallback(async () => {
    if (!manualNombre || !pagina) return;
    setStatus('Cargando puntos...');
    try {
      const nextPanel = await getAdminVisualPoints({ manualNombre, pagina });
      setPanel(nextPanel);
      setDataPageMode(nextPanel.dataPageConfig?.mode || 'same');
      setCustomDataPage(String(nextPanel.paginaDatos || pagina));
      setStatus('');
    } catch (error) {
      setStatus(error.message || 'No se pudieron cargar los puntos.');
    }
  }, [manualNombre, pagina]);

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
    if (!referenciaDespiece.trim()) return 'Ingresá la referencia de despiece.';
    return '';
  };

  const refreshPointInPanel = (point) => {
    setPanel((current) => {
      if (!current) return current;
      const exists = current.puntos.some((item) => item.id === point.id);
      const puntos = exists ? current.puntos.map((item) => (item.id === point.id ? { ...item, ...point } : item)) : [...current.puntos, point];
      return { ...current, puntos: puntos.sort((a, b) => String(a.referenciaDespiece).localeCompare(String(b.referenciaDespiece), undefined, { numeric: true })) };
    });
  };

  const refreshPointDetails = async () => {
    if (!manualNombre || !pagina) return;
    const nextPanel = await getAdminVisualPoints({ manualNombre, pagina });
    setPanel(nextPanel);
    setDataPageMode(nextPanel.dataPageConfig?.mode || 'same');
    setCustomDataPage(String(nextPanel.paginaDatos || pagina));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationMessage = validateForm();
    if (validationMessage) { setStatus(validationMessage); focusReferenceInput(); return; }

    const trimmedReference = referenciaDespiece.trim();
    const duplicatePoint = findDuplicatePoint(trimmedReference);
    if (duplicatePoint) {
      selectPoint(duplicatePoint, `La referencia ${trimmedReference} ya existe. Se seleccionó el punto existente para editarlo.`);
      return;
    }

    const payload = { manualNombre, pagina, referenciaDespiece: trimmedReference, repuestoManualId: selectedManualLink?.id ?? null, ...manualPointData, ...coords, activo: true };
    try {
      const savedPoint = editingId ? await updateAdminVisualPoint(editingId, payload) : await createAdminVisualPoint(payload);
      refreshPointInPanel(savedPoint);
      await refreshPointDetails();
      setLastCreatedPointId(editingId ? null : savedPoint?.id ?? null);
      selectPoint({ ...savedPoint, codigo: selectedManualLink?.codigo ?? selectedPoint?.codigo, descripcion: selectedManualLink?.descripcion ?? selectedPoint?.descripcion }, editingId ? `Punto ${trimmedReference} actualizado.` : `Punto ${trimmedReference} guardado.`);
    } catch (error) { setStatus(error.message || 'Error al guardar punto'); }
  };

  const handleImageClick = (event) => {
    if (event.target.closest('.visual-panel__marker')) return;
    const nextCoords = coordsFromPointer(event, event.currentTarget);
    setCoords(nextCoords);
    setEditingId(null);
    setMoveMode(false);
    setManualPointData(emptyManualPointData);
    setStatus(`Nuevo punto en X ${nextCoords.xPercent}% / Y ${nextCoords.yPercent}%. Ingresá una referencia y guardá.`);
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

  useEffect(() => {
    const handleKeyboardShortcut = (event) => {
      if (event.key === 'Escape') { resetForm(); setStatus('Edición cancelada.'); }
      if (event.key === 'Delete' && editingId) { event.preventDefault(); handleDelete(editingId); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && lastCreatedPointId) { event.preventDefault(); handleUndoLastPoint(); }
    };
    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  }, [editingId, handleDelete, handleUndoLastPoint, lastCreatedPointId, resetForm]);

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
            <button type="button" className="button" onClick={loadPanel}>Cargar imagen y puntos</button>
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
                <div ref={imageWrapRef} className={`visual-panel__image-stage admin-visual-image-stage${moveMode ? ' visual-panel__image-wrap--dragging' : ''}`} onClick={handleImageClick} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} role="button" tabIndex="0">
                  {panel?.imageUrl ? <img src={`${apiUrl}${panel.imageUrl}`} alt={`Manual ${manualNombre} página ${pagina}`} draggable="false" /> : <p className="status-message manual-spare-parts-empty">No hay imagen cargada para esta página.</p>}
                  {(panel?.puntos || []).map((point) => <button type="button" key={point.id} className={`visual-panel__marker${editingId === point.id ? ' visual-panel__marker--selected' : ''}`} onPointerDown={(event) => handleMarkerPointerDown(event, point)} style={{ left: `${point.xPercent}%`, top: `${point.yPercent}%` }}>{point.referenciaDespiece}</button>)}
                  {coords && !editingId ? <span className="visual-panel__marker visual-panel__marker--draft" style={{ left: `${coords.xPercent}%`, top: `${coords.yPercent}%` }}>+</span> : null}
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
                <div className="admin-visual-card__header"><h3>Datos básicos del punto</h3></div>
                <div className="admin-visual-fields-grid">
                  <label>Referencia despiece<input ref={referenceInputRef} value={referenciaDespiece} onChange={(event) => setReferenciaDespiece(event.target.value)} placeholder="Ej.: 7" /></label>
                  <label>Posición X<input value={coords?.xPercent ?? ''} readOnly placeholder="Sin capturar" /></label>
                  <label>Posición Y<input value={coords?.yPercent ?? ''} readOnly placeholder="Sin capturar" /></label>
                </div>
                <p className="admin-visual-selection">Estado: {coords ? 'posición capturada' : 'sin capturar'}</p>
                <div className="admin-visual-actions">
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
