import { useEffect, useMemo, useState } from 'react';

import AdminLayout from '../../components/admin/AdminLayout.jsx';
import {
  getAdminAccessRequests,
  getValidAccessRequestStatuses,
  updateAdminAccessRequestStatus
} from '../../services/accessRequestsService.js';

const allStatusesFilterValue = 'Todos';

function formatDate(value) {
  if (!value) {
    return 'Sin fecha';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

function getDateInputValue(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-AR');
}

function getAccessRequestSearchHaystack(accessRequest) {
  return normalizeSearchText([
    accessRequest.nombre,
    accessRequest.email,
    accessRequest.telefono,
    accessRequest.empresa,
    accessRequest.cuit,
    accessRequest.localidad,
    accessRequest.cargo,
    accessRequest.estado
  ].filter(Boolean).join(' '));
}

function getStatusPillClassName(status) {
  const classNames = ['admin-status-pill', 'admin-access-request-status-pill'];

  if (status === 'Pendiente') {
    classNames.push('is-pending');
  }

  if (status === 'Aprobado') {
    classNames.push('is-approved');
  }

  if (status === 'Rechazado') {
    classNames.push('is-rejected');
  }

  return classNames.join(' ');
}

function AdminAccessRequestsPage({ currentPath = '/admin/solicitudes-acceso' }) {
  const [accessRequests, setAccessRequests] = useState([]);
  const [selectedAccessRequestId, setSelectedAccessRequestId] = useState(null);
  const [statusFilter, setStatusFilter] = useState(allStatusesFilterValue);
  const [dateFilter, setDateFilter] = useState('');
  const [textFilter, setTextFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [updatingAccessRequestId, setUpdatingAccessRequestId] = useState(null);

  const statuses = getValidAccessRequestStatuses();

  useEffect(() => {
    let isMounted = true;

    async function loadAccessRequests() {
      setIsLoading(true);
      setLoadError('');

      try {
        const response = await getAdminAccessRequests();

        if (isMounted) {
          setAccessRequests(Array.isArray(response) ? response : []);
        }
      } catch (currentError) {
        if (isMounted) {
          setAccessRequests([]);
          setLoadError(currentError.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadAccessRequests();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredAccessRequests = useMemo(() => {
    const normalizedTextFilter = normalizeSearchText(textFilter);

    return accessRequests.filter((accessRequest) => {
      const matchesStatus = statusFilter === allStatusesFilterValue || accessRequest.estado === statusFilter;
      const matchesDate = !dateFilter || getDateInputValue(accessRequest.fechaCreacion) === dateFilter;
      const matchesText = !normalizedTextFilter || getAccessRequestSearchHaystack(accessRequest).includes(normalizedTextFilter);

      return matchesStatus && matchesDate && matchesText;
    });
  }, [accessRequests, dateFilter, statusFilter, textFilter]);

  const selectedAccessRequest = useMemo(
    () => filteredAccessRequests.find((accessRequest) => String(accessRequest.id) === String(selectedAccessRequestId))
      ?? filteredAccessRequests[0]
      ?? null,
    [filteredAccessRequests, selectedAccessRequestId]
  );

  async function handleStatusChange(accessRequestId, estado) {
    setUpdatingAccessRequestId(accessRequestId);
    setActionError('');
    setSaveMessage('');

    try {
      const updatedAccessRequest = await updateAdminAccessRequestStatus(accessRequestId, estado);

      setAccessRequests((currentAccessRequests) =>
        currentAccessRequests.map((accessRequest) => (
          accessRequest.id === accessRequestId ? updatedAccessRequest : accessRequest
        ))
      );
      setSelectedAccessRequestId(updatedAccessRequest.id);
      setSaveMessage('Estado de solicitud actualizado correctamente.');
    } catch (currentError) {
      setActionError(currentError.message);
    } finally {
      setUpdatingAccessRequestId(null);
    }
  }

  function handleClearFilters() {
    setStatusFilter(allStatusesFilterValue);
    setDateFilter('');
    setTextFilter('');
  }

  function renderDetail() {
    if (!selectedAccessRequest) {
      return <p className="status-message">Seleccioná una solicitud para ver el detalle.</p>;
    }

    return (
      <article className="admin-inquiry-detail" aria-live="polite">
        <div className="admin-inquiry-detail__header">
          <div>
            <p className="eyebrow">Detalle</p>
            <h3>{selectedAccessRequest.nombre}</h3>
            <p>{selectedAccessRequest.empresa}</p>
          </div>
          <span className={getStatusPillClassName(selectedAccessRequest.estado)}>{selectedAccessRequest.estado}</span>
        </div>

        <dl className="admin-inquiry-detail__grid">
          <div><dt>Nombre</dt><dd>{selectedAccessRequest.nombre}</dd></div>
          <div><dt>Email</dt><dd>{selectedAccessRequest.email}</dd></div>
          <div><dt>Teléfono</dt><dd>{selectedAccessRequest.telefono}</dd></div>
          <div><dt>Empresa</dt><dd>{selectedAccessRequest.empresa}</dd></div>
          <div><dt>CUIT</dt><dd>{selectedAccessRequest.cuit}</dd></div>
          <div><dt>Localidad</dt><dd>{selectedAccessRequest.localidad}</dd></div>
          <div><dt>Cargo</dt><dd>{selectedAccessRequest.cargo || 'Sin cargo informado'}</dd></div>
          <div><dt>Estado</dt><dd>{selectedAccessRequest.estado}</dd></div>
          <div><dt>Fecha de creación</dt><dd>{formatDate(selectedAccessRequest.fechaCreacion)}</dd></div>
          <div><dt>Fecha de actualización</dt><dd>{formatDate(selectedAccessRequest.fechaActualizacion)}</dd></div>
        </dl>
      </article>
    );
  }

  return (
    <AdminLayout currentPath={currentPath}>
      <section className="admin-page-heading admin-machines-heading">
        <div>
          <p className="eyebrow">Solicitudes de acceso</p>
          <h1>Gestión de acceso de clientes</h1>
          <p>Revisá las solicitudes recibidas y marcá cada caso como pendiente, aprobado o rechazado.</p>
        </div>
      </section>

      {loadError ? <p className="status-message status-message--error">{loadError}</p> : null}
      {actionError ? <p className="status-message status-message--error">{actionError}</p> : null}
      {saveMessage ? <p className="admin-save-message">{saveMessage}</p> : null}

      <section className="admin-card" aria-labelledby="admin-access-request-filters-title">
        <div className="admin-section-heading">
          <p className="eyebrow">Filtros</p>
          <h2 id="admin-access-request-filters-title">Buscar solicitudes</h2>
        </div>

        <div className="admin-inquiry-filters">
          <label>
            <span className="admin-field-label">Estado</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value={allStatusesFilterValue}>Todos</option>
              {statuses.map((status) => <option value={status} key={status}>{status}</option>)}
            </select>
          </label>

          <label>
            <span className="admin-field-label">Fecha</span>
            <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
          </label>

          <label className="admin-form-field--wide">
            <span className="admin-field-label">Texto libre</span>
            <input
              type="search"
              placeholder="Nombre, email, teléfono, empresa, CUIT o localidad"
              value={textFilter}
              onChange={(event) => setTextFilter(event.target.value)}
            />
          </label>

          <button className="admin-button admin-button--secondary" type="button" onClick={handleClearFilters}>
            Limpiar filtros
          </button>
        </div>
      </section>

      <section className="admin-inquiries-grid">
        <article className="admin-card" aria-labelledby="admin-access-requests-list-title">
          <div className="admin-section-heading admin-inquiries-list-heading">
            <div>
              <p className="eyebrow">Listado</p>
              <h2 id="admin-access-requests-list-title">Solicitudes recibidas</h2>
            </div>
            <span>{filteredAccessRequests.length} resultado(s)</span>
          </div>

          {isLoading ? (
            <p className="status-message">Cargando solicitudes...</p>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-machines-table admin-access-requests-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Empresa</th>
                    <th>CUIT</th>
                    <th>Localidad</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccessRequests.map((accessRequest) => (
                    <tr key={accessRequest.id} className={selectedAccessRequest?.id === accessRequest.id ? 'is-selected' : undefined}>
                      <td data-label="Fecha">{formatDate(accessRequest.fechaCreacion)}</td>
                      <td data-label="Nombre"><strong>{accessRequest.nombre}</strong></td>
                      <td data-label="Email">{accessRequest.email}</td>
                      <td data-label="Teléfono">{accessRequest.telefono}</td>
                      <td data-label="Empresa">{accessRequest.empresa}</td>
                      <td data-label="CUIT">{accessRequest.cuit}</td>
                      <td data-label="Localidad">{accessRequest.localidad}</td>
                      <td data-label="Estado"><span className={getStatusPillClassName(accessRequest.estado)}>{accessRequest.estado}</span></td>
                      <td data-label="Acciones">
                        <div className="admin-table-actions admin-inquiry-actions admin-access-request-actions">
                          <button className="admin-button admin-button--secondary" type="button" onClick={() => setSelectedAccessRequestId(accessRequest.id)}>
                            Ver detalle
                          </button>
                          {statuses.map((status) => (
                            <button
                              className={status === 'Rechazado' ? 'admin-button admin-button--danger' : 'admin-button admin-button--secondary'}
                              type="button"
                              key={status}
                              onClick={() => handleStatusChange(accessRequest.id, status)}
                              disabled={updatingAccessRequestId === accessRequest.id || accessRequest.estado === status}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredAccessRequests.length === 0 ? (
                    <tr><td colSpan="9">No hay solicitudes que coincidan con los filtros aplicados.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <aside className="admin-card admin-inquiry-detail-card" aria-labelledby="admin-access-request-detail-title">
          <div className="admin-section-heading">
            <p className="eyebrow">Acción</p>
            <h2 id="admin-access-request-detail-title">Ver detalle</h2>
          </div>
          {renderDetail()}
        </aside>
      </section>
    </AdminLayout>
  );
}

export default AdminAccessRequestsPage;
