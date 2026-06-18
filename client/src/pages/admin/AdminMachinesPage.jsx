import { useEffect, useMemo, useState } from 'react';

import AdminLayout from '../../components/admin/AdminLayout.jsx';
import {
  createMachine,
  deleteMachine,
  getAdminMachines,
  updateMachine,
  uploadMachineImage
} from '../../services/machinesService.js';
import { getMachineCategory, getMachineStatus, isAvailableMachine, machineCategories, machineStatuses } from '../../utils/machines.js';


const categoryHelpTexts = {
  Nueva: 'Publicación de una maquinaria nueva.',
  Usada: 'Publicación de una maquinaria usada.',
  'Trabajo Realizado': 'Publicación institucional de un trabajo ya realizado; no significa que esté vendido.'
};

const statusHelpTexts = {
  Disponible: 'Disponible comercialmente: puede recibir consultas desde el sitio público.',
  Vendido: 'Vendido comercialmente: conserva el detalle visible, pero no permite consulta sobre esa unidad.'
};

function getCategoryHelpText(category) {
  return categoryHelpTexts[category] ?? 'Define qué tipo de publicación se mostrará: Nueva, Usada o Trabajo Realizado.';
}

function getStatusHelpText(status) {
  return statusHelpTexts[status] ?? 'Define si la unidad está comercialmente disponible o ya figura como Vendido.';
}

function getStatusPillClassName(status) {
  return status === 'Disponible' ? 'admin-status-pill is-available' : 'admin-status-pill is-sold';
}

function getCategoryPillClassName(category) {
  return category === 'Trabajo Realizado' ? 'admin-category-pill is-work' : 'admin-category-pill';
}

const emptyMachineForm = {
  nombre: '',
  slug: '',
  marca: '',
  categoria: '',
  estado: 'Disponible',
  descripcionCorta: '',
  descripcionLarga: '',
  imagenPrincipal: '',
  galeria: [],
  disponible: true,
  activo: true
};

function AdminMachinesPage({ currentPath = '/admin/maquinarias' }) {
  const [machines, setMachines] = useState([]);
  const [formData, setFormData] = useState(emptyMachineForm);
  const [editingMachineId, setEditingMachineId] = useState(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [errors, setErrors] = useState({});
  const [saveMessage, setSaveMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingMachineId, setDeletingMachineId] = useState(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');

  const formTitle = useMemo(
    () => (editingMachineId ? 'Editar maquinaria' : 'Nueva maquinaria'),
    [editingMachineId]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadMachines() {
      setIsLoading(true);
      setLoadError('');
      setIsUsingFallback(false);

      try {
        const response = await getAdminMachines();

        if (!isMounted) {
          return;
        }

        setMachines(Array.isArray(response) ? response : []);

        if (response?.isFallback) {
          setIsUsingFallback(true);
          setLoadError('No se pudo conectar con la API real. Se muestran maquinarias mock temporalmente.');
        }
      } catch (currentError) {
        if (isMounted) {
          setMachines([]);
          setLoadError(currentError.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadMachines();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleNewMachine() {
    setFormData(emptyMachineForm);
    setEditingMachineId(null);
    setErrors({});
    setSaveMessage('');
    setActionError('');
    setIsFormVisible(true);
  }

  function handleEditMachine(machine) {
    setFormData({
      nombre: machine.nombre ?? '',
      slug: machine.slug ?? '',
      marca: machine.marca ?? '',
      categoria: getMachineCategory(machine),
      estado: getMachineStatus(machine),
      descripcionCorta: machine.descripcionCorta ?? '',
      descripcionLarga: machine.descripcionLarga ?? '',
      imagenPrincipal: machine.imagenPrincipal ?? '',
      galeria: Array.isArray(machine.galeria) ? machine.galeria : [],
      disponible: isAvailableMachine(machine),
      activo: machine.activo ?? true
    });
    setEditingMachineId(machine.id);
    setErrors({});
    setSaveMessage('');
    setActionError('');
    setIsFormVisible(true);
  }

  async function handleDeleteMachine(machineId) {
    if (isUsingFallback) {
      setActionError('La API real no está disponible. No se puede eliminar usando datos mock temporales.');
      return;
    }

    setDeletingMachineId(machineId);
    setActionError('');
    setSaveMessage('');

    try {
      await deleteMachine(machineId);
      setMachines((currentMachines) => currentMachines.filter((machine) => machine.id !== machineId));

      if (editingMachineId === machineId) {
        handleCancelForm();
      }

      setSaveMessage('Maquinaria eliminada correctamente.');
    } catch (currentError) {
      setActionError(currentError.message);
    } finally {
      setDeletingMachineId(null);
    }
  }

  function handleCancelForm() {
    setFormData(emptyMachineForm);
    setEditingMachineId(null);
    setErrors({});
    setIsFormVisible(false);
  }

  function handleInputChange(event) {
    const { name, type, value, checked } = event.target;
    const nextValue = type === 'checkbox' ? checked : value;

    setFormData((currentFormData) => ({
      ...currentFormData,
      [name]: nextValue
    }));

    if (errors[name]) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        [name]: ''
      }));
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(file);
    });
  }

  async function uploadSelectedFiles(files, target) {
    const imageFiles = Array.from(files ?? []);

    if (imageFiles.some((file) => !file.type.startsWith('image/'))) {
      setImageUploadError('Solo se permiten archivos de imagen.');
      return;
    }

    setImageUploadError('');
    setIsSaving(true);

    try {
      const uploadedUrls = [];
      for (const file of imageFiles) {
        const dataUrl = await readFileAsDataUrl(file);
        const uploadedImage = await uploadMachineImage(dataUrl);
        uploadedUrls.push(uploadedImage.url);
      }

      setFormData((currentFormData) => ({
        ...currentFormData,
        imagenPrincipal: target === 'principal' ? uploadedUrls[0] ?? currentFormData.imagenPrincipal : currentFormData.imagenPrincipal,
        galeria: target === 'galeria' ? [...currentFormData.galeria, ...uploadedUrls] : currentFormData.galeria
      }));
    } catch (currentError) {
      setImageUploadError(currentError.message);
    } finally {
      setIsSaving(false);
    }
  }

  function removeGalleryImage(imageUrl) {
    setFormData((currentFormData) => ({
      ...currentFormData,
      galeria: currentFormData.galeria.filter((url) => url !== imageUrl)
    }));
  }

  function validateForm() {
    const nextErrors = {};

    if (!formData.nombre.trim()) {
      nextErrors.nombre = 'Ingresá el nombre o título de la maquinaria.';
    }

    if (!formData.categoria.trim()) {
      nextErrors.categoria = 'Seleccioná si la publicación es Nueva, Usada o Trabajo Realizado.';
    }

    if (!formData.estado.trim()) {
      nextErrors.estado = 'Seleccioná si la maquinaria está Disponible o Vendido comercialmente.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (isUsingFallback) {
      setActionError('La API real no está disponible. No se puede guardar usando datos mock temporales.');
      return;
    }

    const machinePayload = {
      nombre: formData.nombre.trim(),
      slug: formData.slug.trim(),
      marca: formData.marca.trim(),
      categoria: formData.categoria.trim(),
      estado: formData.estado.trim(),
      descripcionCorta: formData.descripcionCorta.trim(),
      descripcionLarga: formData.descripcionLarga.trim(),
      imagenPrincipal: formData.imagenPrincipal.trim() || null,
      galeria: formData.galeria,
      disponible: formData.estado === 'Disponible',
      activo: formData.activo
    };

    setIsSaving(true);
    setActionError('');
    setSaveMessage('');

    try {
      const savedMachine = editingMachineId
        ? await updateMachine(editingMachineId, machinePayload)
        : await createMachine(machinePayload);

      if (editingMachineId) {
        setMachines((currentMachines) =>
          currentMachines.map((machine) => (machine.id === editingMachineId ? savedMachine : machine))
        );
      } else {
        setMachines((currentMachines) => [savedMachine, ...currentMachines]);
      }

      handleCancelForm();
      setSaveMessage('Maquinaria guardada correctamente.');
    } catch (currentError) {
      setActionError(currentError.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminLayout currentPath={currentPath}>
      <section className="admin-page-heading admin-machines-heading">
        <div>
          <p className="eyebrow">Maquinarias</p>
          <h1>Gestión de maquinarias</h1>
          <p>
            Desde aquí se administran las publicaciones de maquinarias, trabajos realizados y su
            disponibilidad comercial con persistencia real en la API.
          </p>
        </div>
        <button className="admin-button admin-button--primary" type="button" onClick={handleNewMachine}>
          Nueva maquinaria
        </button>
      </section>

      {saveMessage && (
        <div className="admin-save-message" role="status">
          {saveMessage}
        </div>
      )}
      {loadError && <p className="status-message status-message--error">{loadError}</p>}
      {actionError && <p className="status-message status-message--error">{actionError}</p>}

      {isFormVisible && (
        <section className="admin-card admin-machine-form-card" aria-labelledby="admin-machine-form-title">
          <div className="admin-section-heading">
            <p className="eyebrow">Formulario</p>
            <h2 id="admin-machine-form-title">{formTitle}</h2>
          </div>

          <form className="admin-machine-form" onSubmit={handleSubmit} noValidate>
            <div className="admin-form-grid">
              <label>
                <span className="admin-field-label">
                  Nombre / título <span aria-hidden="true">*</span>
                </span>
                <input
                  name="nombre"
                  type="text"
                  value={formData.nombre}
                  onChange={handleInputChange}
                  aria-invalid={Boolean(errors.nombre)}
                  disabled={isSaving}
                />
                <small className="admin-form-help">Nombre principal visible en el listado y el detalle público.</small>
                {errors.nombre && <small className="admin-form-error">{errors.nombre}</small>}
              </label>

              <label>
                <span className="admin-field-label">Marca</span>
                <input
                  name="marca"
                  type="text"
                  value={formData.marca}
                  onChange={handleInputChange}
                  disabled={isSaving}
                  placeholder="Ej: John Deere, Massey Ferguson"
                />
                <small className="admin-form-help">Marca visible en el detalle público y en el contexto de consulta.</small>
              </label>

              <label>
                <span className="admin-field-label">Slug público</span>
                <input
                  name="slug"
                  type="text"
                  value={formData.slug}
                  onChange={handleInputChange}
                  disabled={isSaving}
                  placeholder="Se genera desde el nombre si se deja vacío"
                />
                <small className="admin-form-help">
                  Identificador de la URL. En edición se precarga para no cambiar el enlace existente por error.
                </small>
              </label>

              <label>
                <span className="admin-field-label">
                  Categoría de publicación <span aria-hidden="true">*</span>
                </span>
                <select
                  name="categoria"
                  value={formData.categoria}
                  onChange={handleInputChange}
                  aria-invalid={Boolean(errors.categoria)}
                  disabled={isSaving}
                >
                  <option value="">Seleccionar categoría</option>
                  {machineCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <small className="admin-form-help">{getCategoryHelpText(formData.categoria)}</small>
                {errors.categoria && <small className="admin-form-error">{errors.categoria}</small>}
              </label>

              <label>
                <span className="admin-field-label">
                  Estado comercial <span aria-hidden="true">*</span>
                </span>
                <select
                  name="estado"
                  value={formData.estado}
                  onChange={handleInputChange}
                  aria-invalid={Boolean(errors.estado)}
                  disabled={isSaving}
                >
                  <option value="">Seleccionar estado</option>
                  {machineStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <small className="admin-form-help">{getStatusHelpText(formData.estado)}</small>
                {errors.estado && <small className="admin-form-error">{errors.estado}</small>}
              </label>

              <div className="admin-checkbox-field admin-form-field--wide" aria-live="polite">
                <span>
                  Categoría y estado son independientes: “Trabajo Realizado” describe el tipo de publicación;
                  “Vendido” indica que no está comercialmente disponible.
                </span>
              </div>

              <label className="admin-form-field--wide">
                <span className="admin-field-label">Descripción corta</span>
                <textarea
                  name="descripcionCorta"
                  rows="3"
                  value={formData.descripcionCorta}
                  onChange={handleInputChange}
                  disabled={isSaving}
                />
              </label>

              <label className="admin-form-field--wide">
                <span className="admin-field-label">Descripción larga</span>
                <textarea
                  name="descripcionLarga"
                  rows="5"
                  value={formData.descripcionLarga}
                  onChange={handleInputChange}
                  disabled={isSaving}
                />
              </label>
            </div>

            <section className="admin-images-section" aria-labelledby="admin-machine-images-title">
              <div className="admin-section-heading admin-section-heading--compact">
                <p className="eyebrow">Imágenes</p>
                <h3 id="admin-machine-images-title">Imágenes de la publicación</h3>
                <p>Se guardan localmente en la API, dentro de <code>api/src/public/uploads/maquinarias</code>.</p>
              </div>
              {imageUploadError && <p className="status-message status-message--error">{imageUploadError}</p>}
              <div className="admin-image-upload-grid">
                <label>
                  <span className="admin-field-label">Imagen principal</span>
                  <input type="file" accept="image/*" disabled={isSaving} onChange={(event) => uploadSelectedFiles(event.target.files, 'principal')} />
                </label>
                {formData.imagenPrincipal ? (
                  <div className="admin-image-preview">
                    <img src={formData.imagenPrincipal} alt="Previsualización principal" />
                    <button className="admin-button admin-button--secondary" type="button" onClick={() => setFormData((current) => ({ ...current, imagenPrincipal: '' }))}>Eliminar imagen principal</button>
                  </div>
                ) : null}
                <label>
                  <span className="admin-field-label">Galería</span>
                  <input type="file" accept="image/*" multiple disabled={isSaving} onChange={(event) => uploadSelectedFiles(event.target.files, 'galeria')} />
                </label>
                <div className="admin-gallery-preview">
                  {formData.galeria.map((imageUrl) => (
                    <div className="admin-image-preview" key={imageUrl}>
                      <img src={imageUrl} alt="Previsualización de galería" />
                      <button className="admin-button admin-button--secondary" type="button" onClick={() => removeGalleryImage(imageUrl)}>Eliminar</button>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <div className="admin-form-actions">
              <button className="admin-button admin-button--primary" type="submit" disabled={isSaving}>
                {isSaving ? 'Guardando...' : 'Guardar maquinaria'}
              </button>
              <button
                className="admin-button admin-button--secondary"
                type="button"
                onClick={handleCancelForm}
                disabled={isSaving}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="admin-card" aria-labelledby="admin-machines-list-title">
        <div className="admin-section-heading">
          <p className="eyebrow">Listado</p>
          <h2 id="admin-machines-list-title">Maquinarias actuales</h2>
        </div>

        {isLoading ? (
          <p className="status-message">Cargando maquinarias...</p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-machines-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Marca</th>
                  <th>Categoría</th>
                  <th>Estado</th>
                  <th>Disponibilidad</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {machines.map((machine) => (
                  <tr key={machine.id}>
                    <td data-label="Nombre">
                      <strong>{machine.nombre}</strong>
                      {machine.slug ? <small className="admin-machine-slug">/{machine.slug}</small> : null}
                    </td>
                    <td data-label="Marca">{machine.marca || 'Sin informar'}</td>
                    <td data-label="Categoría">
                      <span className={getCategoryPillClassName(getMachineCategory(machine))}>
                        {getMachineCategory(machine) || 'Sin categoría'}
                      </span>
                    </td>
                    <td data-label="Estado">
                      <span className={getStatusPillClassName(getMachineStatus(machine))}>
                        {getMachineStatus(machine) || 'Sin estado'}
                      </span>
                    </td>
                    <td data-label="Disponibilidad">
                      {isAvailableMachine(machine)
                        ? 'Permite consultas comerciales'
                        : 'Detalle visible sin consulta comercial'}
                    </td>
                    <td data-label="Acciones">
                      <div className="admin-table-actions">
                        <button
                          className="admin-button admin-button--secondary"
                          type="button"
                          onClick={() => handleEditMachine(machine)}
                          disabled={deletingMachineId === machine.id}
                        >
                          Editar
                        </button>
                        <button
                          className="admin-button admin-button--danger"
                          type="button"
                          onClick={() => handleDeleteMachine(machine.id)}
                          disabled={deletingMachineId === machine.id}
                        >
                          {deletingMachineId === machine.id ? 'Eliminando...' : 'Eliminar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {machines.length === 0 ? (
              <p className="status-message machines-empty">No hay maquinarias cargadas.</p>
            ) : null}
          </div>
        )}
      </section>
    </AdminLayout>
  );
}

export default AdminMachinesPage;
