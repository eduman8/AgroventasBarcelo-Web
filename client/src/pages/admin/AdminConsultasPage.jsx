import { useEffect, useMemo, useState } from 'react';

import AdminLayout from '../../components/admin/AdminLayout.jsx';
import {
  getAdminInquiries,
  getValidInquiryStatuses,
  updateAdminInquiryStatus
} from '../../services/inquiriesService.js';

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

function getInquirySearchHaystack(inquiry) {
  return normalizeSearchText([
    inquiry.nombre,
    inquiry.email,
    inquiry.telefono,
    inquiry.tipoConsulta,
    inquiry.estado,
    inquiry.mensaje,
    inquiry.contexto?.name,
    inquiry.contexto?.code,
    inquiry.contexto?.brand
  ].filter(Boolean).join(' '));
}

function getStatusPillClassName(status) {
  const classNames = ['admin-status-pill', 'admin-inquiry-status-pill'];

  if (status === 'Nueva') {
    classNames.push('is-new');
  }

  if (status === 'En proceso') {
    classNames.push('is-in-progress');
  }

  if (status === 'Respondida') {
    classNames.push('is-answered');
  }

  if (status === 'Cerrada') {
    classNames.push('is-closed');
  }

  return classNames.join(' ');
}

function AdminConsultasPage({ currentPath = '/admin/consultas' }) {
  const [inquiries, setInquiries] = useState([]);
  const [selectedInquiryId, setSelectedInquiryId] = useState(null);
  const [statusFilter, setStatusFilter] = useState(allStatusesFilterValue);
  const [dateFilter, setDateFilter] = useState('');
  const [textFilter, setTextFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [updatingInquiryId, setUpdatingInquiryId] = useState(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  const statuses = getValidInquiryStatuses();

  useEffect(() => {
    let isMounted = true;

    async function loadInquiries() {
      setIsLoading(true);
      setLoadError('');
      setIsUsingFallback(false);

      try {
        const response = await getAdminInquiries();

        if (!isMounted) {
          return;
        }

        setInquiries(Array.isArray(response) ? response : []);

        if (response?.isFallback) {
          setIsUsingFallback(true);
          setLoadError('No se pudo conectar con la API real. Se muestran consultas mock temporalmente.');
        }
      } catch (currentError) {
        if (isMounted) {
          setInquiries([]);
          setLoadError(currentError.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInquiries();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredInquiries = useMemo(() => {
    const normalizedTextFilter = normalizeSearchText(textFilter);

    return inquiries.filter((inquiry) => {
      const matchesStatus = statusFilter === allStatusesFilterValue || inquiry.estado === statusFilter;
      const matchesDate = !dateFilter || getDateInputValue(inquiry.fecha) === dateFilter;
      const matchesText = !normalizedTextFilter || getInquirySearchHaystack(inquiry).includes(normalizedTextFilter);

      return matchesStatus && matchesDate && matchesText;
    });
  }, [dateFilter, inquiries, statusFilter, textFilter]);

  const selectedInquiry = useMemo(
    () => filteredInquiries.find((inquiry) => String(inquiry.id) === String(selectedInquiryId)) ?? filteredInquiries[0] ?? null,
    [filteredInquiries, selectedInquiryId]
  );

  async function handleStatusChange(inquiryId, estado) {
    if (isUsingFallback) {
      setActionError('La API real no está disponible. No se puede cambiar el estado usando datos mock temporales.');
      return;
    }

    setUpdatingInquiryId(inquiryId);
    setActionError('');
    setSaveMessage('');

    try {
      const updatedInquiry = await updateAdminInquiryStatus(inquiryId, estado);

      setInquiries((currentInquiries) =>
        currentInquiries.map((inquiry) => (inquiry.id === inquiryId ? updatedInquiry : inquiry))
      );
      setSaveMessage('Estado de consulta actualizado correctamente.');
    } catch (currentError) {
      setActionError(currentError.message);
    } finally {
      setUpdatingInquiryId(null);
    }
  }

  function handleClearFilters() {
    setStatusFilter(allStatusesFilterValue);
    setDateFilter('');
    setTextFilter('');
  }

  function renderDetail() {
    if (!selectedInquiry) {
      return <p className="status-message">Seleccioná una consulta para ver el detalle.</p>;
    }

    return (
      <article className="admin-inquiry-detail" aria-live="polite">
        <div className="admin-inquiry-detail__header">
          <div>
            <p className="eyebrow">Detalle</p>
            <h3>{selectedInquiry.nombre}</h3>
            <p>{selectedInquiry.tipoConsulta}</p>
          </div>
          <span className={getStatusPillClassName(selectedInquiry.estado)}>{selectedInquiry.estado}</span>
        </div>

        <dl className="admin-inquiry-detail__grid">
          <div>
            <dt>Fecha</dt>
            <dd>{formatDate(selectedInquiry.fecha)}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{selectedInquiry.email}</dd>
          </div>
          <div>
            <dt>Teléfono</dt>
            <dd>{selectedInquiry.telefono}</dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>{selectedInquiry.tipoConsulta}</dd>
          </div>
        </dl>

        <div className="admin-inquiry-message">
          <strong>Mensaje</strong>
          <p>{selectedInquiry.mensaje}</p>
        </div>

        {selectedInquiry.contexto ? (
          <div className="admin-inquiry-message">
            <strong>Contexto</strong>
            <p>
              {[selectedInquiry.contexto.type, selectedInquiry.contexto.name, selectedInquiry.contexto.code]
                .filter(Boolean)
                .join(' · ') || 'Sin contexto adicional'}
            </p>
          </div>
        ) : null}

        {selectedInquiry.informacionManual ? (
          <div className="admin-inquiry-message">
            <strong>Información de manual</strong>
            <p>
              {[
                selectedInquiry.informacionManual.manual,
                selectedInquiry.informacionManual.page ? `Página ${selectedInquiry.informacionManual.page}` : '',
                selectedInquiry.informacionManual.code ? `Código ${selectedInquiry.informacionManual.code}` : ''
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <AdminLayout currentPath={currentPath}>
      <section className="admin-page-heading admin-machines-heading">
        <div>
          <p className="eyebrow">Centro de Consultas</p>
          <h1>Consultas recibidas</h1>
          <p>Gestioná desde una bandeja centralizada las consultas comerciales enviadas por clientes.</p>
        </div>
      </section>

      {loadError ? <p className="admin-save-message admin-save-message--warning">{loadError}</p> : null}
      {actionError ? <p className="status-message status-message--error">{actionError}</p> : null}
      {saveMessage ? <p className="admin-save-message">{saveMessage}</p> : null}

      <section className="admin-card" aria-labelledby="admin-inquiry-filters-title">
        <div className="admin-section-heading">
          <p className="eyebrow">Filtros</p>
          <h2 id="admin-inquiry-filters-title">Buscar consultas</h2>
        </div>

        <div className="admin-inquiry-filters">
          <label>
            <span className="admin-field-label">Estado</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value={allStatusesFilterValue}>Todos</option>
              {statuses.map((status) => (
                <option value={status} key={status}>{status}</option>
              ))}
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
              placeholder="Nombre, email, teléfono, tipo o mensaje"
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
        <article className="admin-card" aria-labelledby="admin-inquiries-list-title">
          <div className="admin-section-heading admin-inquiries-list-heading">
            <div>
              <p className="eyebrow">Listado</p>
              <h2 id="admin-inquiries-list-title">Bandeja de consultas</h2>
            </div>
            <span>{filteredInquiries.length} resultado(s)</span>
          </div>

          {isLoading ? (
            <p className="status-message">Cargando consultas...</p>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-machines-table admin-inquiries-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Tipo de consulta</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInquiries.map((inquiry) => (
                    <tr key={inquiry.id} className={selectedInquiry?.id === inquiry.id ? 'is-selected' : undefined}>
                      <td data-label="Fecha">{formatDate(inquiry.fecha)}</td>
                      <td data-label="Nombre"><strong>{inquiry.nombre}</strong></td>
                      <td data-label="Email">{inquiry.email}</td>
                      <td data-label="Teléfono">{inquiry.telefono}</td>
                      <td data-label="Tipo de consulta">{inquiry.tipoConsulta}</td>
                      <td data-label="Estado">
                        <span className={getStatusPillClassName(inquiry.estado)}>{inquiry.estado}</span>
                      </td>
                      <td data-label="Acciones">
                        <div className="admin-table-actions admin-inquiry-actions">
                          <button
                            className="admin-button admin-button--secondary"
                            type="button"
                            onClick={() => setSelectedInquiryId(inquiry.id)}
                          >
                            Ver detalle
                          </button>
                          <select
                            aria-label={`Cambiar estado de consulta de ${inquiry.nombre}`}
                            value={inquiry.estado}
                            onChange={(event) => handleStatusChange(inquiry.id, event.target.value)}
                            disabled={updatingInquiryId === inquiry.id}
                          >
                            {statuses.map((status) => (
                              <option value={status} key={status}>{status}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredInquiries.length === 0 ? (
                    <tr>
                      <td colSpan="7">No hay consultas que coincidan con los filtros aplicados.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <aside className="admin-card admin-inquiry-detail-card" aria-labelledby="admin-inquiry-detail-title">
          <div className="admin-section-heading">
            <p className="eyebrow">Acción</p>
            <h2 id="admin-inquiry-detail-title">Ver detalle</h2>
          </div>
          {renderDetail()}
        </aside>
      </section>
    </AdminLayout>
  );
}

export default AdminConsultasPage;
