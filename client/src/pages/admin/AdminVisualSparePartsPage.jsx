import { useCallback, useEffect, useRef, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import { apiUrl } from '../../services/sparePartsService.js';
import { createAdminVisualPoint, deleteAdminVisualPoint, getAdminVisualPoints, updateAdminVisualPoint, uploadVisualManualPdf } from '../../services/manualSparePartsSearchService.js';

const manualOptions = [
  { label: 'Repuestos Rastras', value: 'Repuestos Rastras' },
  { label: 'Grano Fino 2019', value: 'Grano Fino 2019' }
];

const normalizeDuplicateValue = (value) => String(value ?? '').trim().toUpperCase();

function AdminVisualSparePartsPage({ currentPath }) {
  const [manualNombre, setManualNombre] = useState(manualOptions[0].value);
  const [pagina, setPagina] = useState('');
  const [referenciaDespiece, setReferenciaDespiece] = useState('');
  const [coords, setCoords] = useState(null);
  const [panel, setPanel] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [generatedPages, setGeneratedPages] = useState([]);
  const [lastCreatedPointId, setLastCreatedPointId] = useState(null);
  const referenceInputRef = useRef(null);

  const loadPanel = useCallback(async () => {
    if (!manualNombre || !pagina) return;
    setStatus('Cargando puntos...');
    try {
      setPanel(await getAdminVisualPoints({ manualNombre, pagina }));
      setStatus('');
    } catch (error) {
      setStatus(error.message || 'No se pudieron cargar los puntos.');
    }
  }, [manualNombre, pagina]);

  useEffect(() => { loadPanel(); }, [loadPanel]);

  const focusReferenceInput = () => {
    window.requestAnimationFrame(() => referenceInputRef.current?.focus());
  };

  const handleImageClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setCoords({
      xPercent: Number((((event.clientX - rect.left) / rect.width) * 100).toFixed(3)),
      yPercent: Number((((event.clientY - rect.top) / rect.height) * 100).toFixed(3))
    });
    focusReferenceInput();
  };

  const resetForm = useCallback(() => { setReferenciaDespiece(''); setCoords(null); setEditingId(null); }, []);

  const findDuplicatePoint = (reference) => (panel?.puntos || []).find((point) => (
    point.id !== editingId
    && normalizeDuplicateValue(point.manualNombre || manualNombre) === normalizeDuplicateValue(manualNombre)
    && String(point.pagina || pagina) === String(pagina)
    && normalizeDuplicateValue(point.referenciaDespiece) === normalizeDuplicateValue(reference)
  ));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!coords) { setStatus('Hacé clic sobre la imagen para capturar la posición.'); return; }
    const trimmedReference = referenciaDespiece.trim();
    if (!trimmedReference) { setStatus('Ingresá la referencia de despiece.'); focusReferenceInput(); return; }

    const duplicatePoint = findDuplicatePoint(trimmedReference);
    if (!editingId && duplicatePoint) {
      const shouldCreateDuplicate = window.confirm(`Ya existe un punto para ${manualNombre}, página ${pagina}, referencia ${trimmedReference}. ¿Querés crear otro punto igual de todos modos? También podés cancelar y editar el existente desde el listado.`);
      if (!shouldCreateDuplicate) {
        setStatus(`Referencia ${trimmedReference} ya existe. Cancelado para evitar duplicados.`);
        return;
      }
    }

    const payload = { manualNombre, pagina, referenciaDespiece: trimmedReference, ...coords, activo: true };
    try {
      let savedPoint = null;
      if (editingId) savedPoint = await updateAdminVisualPoint(editingId, payload);
      else savedPoint = await createAdminVisualPoint(payload);
      resetForm();
      await loadPanel();
      setLastCreatedPointId(editingId ? null : savedPoint?.id ?? null);
      setStatus(editingId ? `Punto ${trimmedReference} actualizado` : `Punto ${trimmedReference} guardado`);
      focusReferenceInput();
    } catch (error) { setStatus(error.message || 'Error al guardar punto'); }
  };

  const handleEdit = (point) => {
    setEditingId(point.id);
    setReferenciaDespiece(point.referenciaDespiece);
    setCoords({ xPercent: point.xPercent, yPercent: point.yPercent });
    setStatus(`Editando punto ${point.referenciaDespiece}. Enter actualiza, Escape cancela.`);
    focusReferenceInput();
  };

  const handleDelete = async (id) => {
    try { await deleteAdminVisualPoint(id); await loadPanel(); setStatus('Punto eliminado.'); if (lastCreatedPointId === id) setLastCreatedPointId(null); }
    catch (error) { setStatus(error.message || 'No se pudo eliminar el punto.'); }
  };

  const handleUndoLastPoint = useCallback(async () => {
    if (!lastCreatedPointId) return;
    try {
      await deleteAdminVisualPoint(lastCreatedPointId);
      setLastCreatedPointId(null);
      resetForm();
      await loadPanel();
      setStatus('Último punto deshecho.');
    } catch (error) {
      setStatus(error.message || 'No se pudo deshacer el último punto.');
    }
  }, [lastCreatedPointId, loadPanel, resetForm]);

  useEffect(() => {
    const handleKeyboardShortcut = (event) => {
      if (event.key === 'Escape') {
        resetForm();
        setStatus('Selección cancelada.');
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && lastCreatedPointId) {
        event.preventDefault();
        handleUndoLastPoint();
      }
    };

    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  }, [handleUndoLastPoint, lastCreatedPointId, resetForm]);

  const handlePdfUpload = async (event) => {
    event.preventDefault();
    if (!manualNombre) { setUploadStatus('Ingresá el nombre del manual.'); return; }
    if (!pdfFile) { setUploadStatus('Seleccioná un archivo PDF.'); return; }
    setUploadStatus('Subiendo PDF...');
    try {
      setUploadStatus('Procesando páginas...');
      const result = await uploadVisualManualPdf({ manualNombre, archivo: pdfFile });
      setGeneratedPages(result.paginas || []);
      setUploadStatus(`${result.paginasGeneradas || 0} páginas generadas.`);
      if (result.paginas?.[0]) {
        setPagina(String(result.paginas[0].pagina));
        setPanel({ manualNombre, pagina: result.paginas[0].pagina, imageUrl: result.paginas[0].imageUrl, puntos: [] });
      }
    } catch (error) {
      setUploadStatus(error.message || 'No se pudo procesar el PDF.');
    }
  };

  return (
    <AdminLayout currentPath={currentPath}>
      <section className="admin-section">
        <div className="admin-section__header">
          <div><p className="admin-topbar__eyebrow">Repuestos</p><h1>Panel visual interactivo</h1></div>
          <span className="admin-visual-quick-badge">Modo carga rápida activo</span>
        </div>
        <form className="admin-visual-form" onSubmit={handlePdfUpload}>
          <h2>Cargar imágenes desde PDF</h2>
          <label>ManualNombre<input value={manualNombre} onChange={(event) => setManualNombre(event.target.value)} placeholder="Ej.: Repuestos Rastras" /></label>
          <label>Archivo PDF<input type="file" accept="application/pdf" onChange={(event) => setPdfFile(event.target.files?.[0] || null)} /></label>
          <button className="button" type="submit">Generar imágenes</button>
          {uploadStatus ? <p className="status-message">{uploadStatus}</p> : null}
          {generatedPages.length ? (
            <label>Página generada<select value={pagina} onChange={(event) => { setPagina(event.target.value); const selected = generatedPages.find((page) => String(page.pagina) === event.target.value); if (selected) setPanel({ manualNombre, pagina: selected.pagina, imageUrl: selected.imageUrl, puntos: [] }); }}>
              {generatedPages.map((page) => <option key={page.pagina} value={page.pagina}>Página {page.pagina} - {page.imageUrl}</option>)}
            </select></label>
          ) : null}
        </form>
        <form className="admin-visual-form" onSubmit={handleSubmit}>
          <label>Manual<select value={manualNombre} onChange={(event) => setManualNombre(event.target.value)}>{manualOptions.map((manual) => <option key={manual.value} value={manual.value}>{manual.label}</option>)}{manualNombre && !manualOptions.some((manual) => manual.value === manualNombre) ? <option value={manualNombre}>{manualNombre}</option> : null}</select></label>
          <label>Página<input type="number" min="1" value={pagina} onChange={(event) => setPagina(event.target.value)} /></label>
          <button type="button" className="button button--secondary" onClick={loadPanel}>Cargar imagen y puntos</button>
          <label>Referencia despiece<input ref={referenceInputRef} value={referenciaDespiece} onChange={(event) => setReferenciaDespiece(event.target.value)} placeholder="Ej.: 7" /></label>
          <p>Posición: {coords ? `${coords.xPercent}% / ${coords.yPercent}%` : 'sin capturar'}</p>
          <button className="button" type="submit">{editingId ? 'Actualizar punto' : 'Guardar punto'}</button>
          {editingId ? <button className="button button--secondary" type="button" onClick={resetForm}>Cancelar edición</button> : null}
          <button className="button button--secondary" type="button" onClick={handleUndoLastPoint} disabled={!lastCreatedPointId}>Deshacer último punto</button>
          <p className="admin-visual-shortcuts">Click en imagen → número → Enter. Escape cancela. Ctrl+Z deshace el último punto nuevo.</p>
        </form>
        {status ? <p className="status-message">{status}</p> : null}
        <div className="visual-panel__image-wrap admin-visual-image" onClick={handleImageClick} role="button" tabIndex="0">
          {panel?.imageUrl ? <img src={`${apiUrl}${panel.imageUrl}`} alt={`Manual ${manualNombre} página ${pagina}`} /> : <p className="status-message manual-spare-parts-empty">No hay imagen cargada para esta página.</p>}
          {(panel?.puntos || []).map((point) => <span key={point.id} className={`visual-panel__marker${editingId === point.id ? ' visual-panel__marker--selected' : ''}`} style={{ left: `${point.xPercent}%`, top: `${point.yPercent}%` }}>{point.referenciaDespiece}</span>)}
          {coords ? <span className="visual-panel__marker visual-panel__marker--draft" style={{ left: `${coords.xPercent}%`, top: `${coords.yPercent}%` }}>+</span> : null}
        </div>
        <div className="manual-spare-parts-table-wrapper">
          <table className="manual-spare-parts-table"><thead><tr><th>Ref.</th><th>X%</th><th>Y%</th><th>Código</th><th>Descripción</th><th>Acciones</th></tr></thead><tbody>{(panel?.puntos || []).map((point) => <tr key={point.id}><td>{point.referenciaDespiece}</td><td>{point.xPercent}</td><td>{point.yPercent}</td><td>{point.codigo}</td><td>{point.descripcion}</td><td><button type="button" onClick={() => handleEdit(point)}>Editar</button> <button type="button" onClick={() => handleDelete(point.id)}>Eliminar</button></td></tr>)}</tbody></table>
        </div>
      </section>
    </AdminLayout>
  );
}

export default AdminVisualSparePartsPage;
