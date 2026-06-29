import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import { apiUrl } from '../../services/sparePartsService.js';
import { createAdminVisualPoint, deleteAdminVisualPoint, getAdminVisualPoints, updateAdminVisualPoint } from '../../services/manualSparePartsSearchService.js';

const manualOptions = [
  { label: 'Repuestos Rastras', value: 'Repuestos Rastras' },
  { label: 'Grano Fino 2019', value: 'Grano Fino 2019' }
];

function AdminVisualSparePartsPage({ currentPath }) {
  const [manualNombre, setManualNombre] = useState(manualOptions[0].value);
  const [pagina, setPagina] = useState('');
  const [referenciaDespiece, setReferenciaDespiece] = useState('');
  const [coords, setCoords] = useState(null);
  const [panel, setPanel] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState('');

  const loadPanel = async () => {
    if (!manualNombre || !pagina) return;
    setStatus('Cargando puntos...');
    try {
      setPanel(await getAdminVisualPoints({ manualNombre, pagina }));
      setStatus('');
    } catch (error) {
      setStatus(error.message || 'No se pudieron cargar los puntos.');
    }
  };

  useEffect(() => { loadPanel(); }, []);

  const handleImageClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setCoords({
      xPercent: Number((((event.clientX - rect.left) / rect.width) * 100).toFixed(3)),
      yPercent: Number((((event.clientY - rect.top) / rect.height) * 100).toFixed(3))
    });
  };

  const resetForm = () => { setReferenciaDespiece(''); setCoords(null); setEditingId(null); };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!coords) { setStatus('Hacé clic sobre la imagen para capturar la posición.'); return; }
    const payload = { manualNombre, pagina, referenciaDespiece, ...coords, activo: true };
    try {
      if (editingId) await updateAdminVisualPoint(editingId, payload);
      else await createAdminVisualPoint(payload);
      resetForm();
      await loadPanel();
      setStatus('Punto visual guardado.');
    } catch (error) { setStatus(error.message || 'No se pudo guardar el punto visual.'); }
  };

  const handleEdit = (point) => {
    setEditingId(point.id);
    setReferenciaDespiece(point.referenciaDespiece);
    setCoords({ xPercent: point.xPercent, yPercent: point.yPercent });
  };

  const handleDelete = async (id) => {
    try { await deleteAdminVisualPoint(id); await loadPanel(); setStatus('Punto eliminado.'); }
    catch (error) { setStatus(error.message || 'No se pudo eliminar el punto.'); }
  };

  return (
    <AdminLayout currentPath={currentPath}>
      <section className="admin-section">
        <div className="admin-section__header">
          <div><p className="admin-topbar__eyebrow">Repuestos</p><h1>Panel visual interactivo</h1></div>
        </div>
        <form className="admin-visual-form" onSubmit={handleSubmit}>
          <label>Manual<select value={manualNombre} onChange={(event) => setManualNombre(event.target.value)}>{manualOptions.map((manual) => <option key={manual.value} value={manual.value}>{manual.label}</option>)}</select></label>
          <label>Página<input type="number" min="1" value={pagina} onChange={(event) => setPagina(event.target.value)} /></label>
          <button type="button" className="button button--secondary" onClick={loadPanel}>Cargar imagen y puntos</button>
          <label>Referencia despiece<input value={referenciaDespiece} onChange={(event) => setReferenciaDespiece(event.target.value)} placeholder="Ej.: 7" /></label>
          <p>Posición: {coords ? `${coords.xPercent}% / ${coords.yPercent}%` : 'sin capturar'}</p>
          <button className="button" type="submit">{editingId ? 'Actualizar punto' : 'Guardar punto'}</button>
          {editingId ? <button className="button button--secondary" type="button" onClick={resetForm}>Cancelar edición</button> : null}
        </form>
        {status ? <p className="status-message">{status}</p> : null}
        <div className="visual-panel__image-wrap admin-visual-image" onClick={handleImageClick} role="button" tabIndex="0">
          {panel?.imageUrl ? <img src={`${apiUrl}${panel.imageUrl}`} alt={`Manual ${manualNombre} página ${pagina}`} /> : <p className="status-message manual-spare-parts-empty">No hay imagen cargada para esta página.</p>}
          {(panel?.puntos || []).map((point) => <span key={point.id} className="visual-panel__marker" style={{ left: `${point.xPercent}%`, top: `${point.yPercent}%` }}>{point.referenciaDespiece}</span>)}
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
