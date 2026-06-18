import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import { defaultSettings, getSettings, updateSettings } from '../../services/settingsService.js';

function AdminSettingsPage({ currentPath = '/admin/configuracion' }) {
  const [formData, setFormData] = useState(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    getSettings().then((settings) => { if (isMounted) setFormData(settings); }).catch((currentError) => setError(currentError.message)).finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setMessage('');
    setError('');
    try {
      setFormData(await updateSettings(formData));
      setMessage('Configuración guardada correctamente.');
    } catch (currentError) {
      setError(currentError.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminLayout currentPath={currentPath}>
      <section className="admin-page-heading">
        <p className="eyebrow">Configuración</p>
        <h1>Configuración del sitio</h1>
        <p>Administrá los datos generales visibles en el footer, contacto y accesos de WhatsApp.</p>
      </section>
      {message && <div className="admin-save-message" role="status">{message}</div>}
      {error && <p className="status-message status-message--error">{error}</p>}
      <section className="admin-card">
        {isLoading ? <p className="status-message">Cargando configuración...</p> : (
          <form className="admin-machine-form" onSubmit={handleSubmit}>
            <div className="admin-form-grid">
              <label><span className="admin-field-label">Email de contacto</span><input name="emailContacto" type="email" value={formData.emailContacto ?? ''} onChange={handleChange} disabled={isSaving} /></label>
              <label><span className="admin-field-label">WhatsApp</span><input name="whatsapp" type="text" value={formData.whatsapp ?? ''} onChange={handleChange} disabled={isSaving} /></label>
              <label><span className="admin-field-label">Instagram</span><input name="instagram" type="text" value={formData.instagram ?? ''} onChange={handleChange} disabled={isSaving} /></label>
              <label><span className="admin-field-label">Ubicación</span><input name="ubicacion" type="text" value={formData.ubicacion ?? ''} onChange={handleChange} disabled={isSaving} /></label>
              <label className="admin-form-field--wide"><span className="admin-field-label">Texto breve del footer</span><textarea name="textoFooter" rows="4" value={formData.textoFooter ?? ''} onChange={handleChange} disabled={isSaving} /></label>
            </div>
            <div className="admin-form-actions"><button className="admin-button admin-button--primary" type="submit" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar configuración'}</button></div>
          </form>
        )}
      </section>
    </AdminLayout>
  );
}

export default AdminSettingsPage;
