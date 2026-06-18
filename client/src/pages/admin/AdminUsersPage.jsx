import { useEffect, useMemo, useState } from 'react';

import AdminLayout from '../../components/admin/AdminLayout.jsx';
import {
  getAdminUsers,
  getValidUserStatuses,
  updateAdminUserStatus
} from '../../services/adminUsersService.js';

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

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-AR');
}

function getUserSearchHaystack(user) {
  return normalizeSearchText([
    user.nombre,
    user.email,
    user.telefono,
    user.empresa,
    user.cuit,
    user.localidad,
    user.cargo,
    user.rol,
    user.estado
  ].filter(Boolean).join(' '));
}

function getStatusPillClassName(status) {
  const classNames = ['admin-status-pill', 'admin-user-status-pill'];

  if (status === 'Activo') {
    classNames.push('is-active');
  }

  if (status === 'Inactivo') {
    classNames.push('is-inactive');
  }

  return classNames.join(' ');
}

function AdminUsersPage({ currentPath = '/admin/usuarios' }) {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [statusFilter, setStatusFilter] = useState(allStatusesFilterValue);
  const [textFilter, setTextFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState(null);

  const statuses = getValidUserStatuses();

  useEffect(() => {
    let isMounted = true;

    async function loadUsers() {
      setIsLoading(true);
      setLoadError('');

      try {
        const response = await getAdminUsers();

        if (isMounted) {
          setUsers(Array.isArray(response) ? response : []);
        }
      } catch (currentError) {
        if (isMounted) {
          setUsers([]);
          setLoadError(currentError.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const normalizedTextFilter = normalizeSearchText(textFilter);

    return users.filter((user) => {
      const matchesStatus = statusFilter === allStatusesFilterValue || user.estado === statusFilter;
      const matchesText = !normalizedTextFilter || getUserSearchHaystack(user).includes(normalizedTextFilter);

      return matchesStatus && matchesText;
    });
  }, [statusFilter, textFilter, users]);

  const selectedUser = useMemo(
    () => filteredUsers.find((user) => String(user.id) === String(selectedUserId))
      ?? filteredUsers[0]
      ?? null,
    [filteredUsers, selectedUserId]
  );

  async function handleStatusChange(userId, estado) {
    setUpdatingUserId(userId);
    setActionError('');
    setSaveMessage('');

    try {
      const updatedUser = await updateAdminUserStatus(userId, estado);

      setUsers((currentUsers) => currentUsers.map((user) => (
        user.id === userId ? updatedUser : user
      )));
      setSelectedUserId(updatedUser.id);
      setSaveMessage(`Usuario ${estado.toLocaleLowerCase('es-AR')} correctamente.`);
    } catch (currentError) {
      setActionError(currentError.message);
    } finally {
      setUpdatingUserId(null);
    }
  }

  function handleClearFilters() {
    setStatusFilter(allStatusesFilterValue);
    setTextFilter('');
  }

  function renderDetail() {
    if (!selectedUser) {
      return <p className="status-message">Seleccioná un usuario para ver el detalle.</p>;
    }

    return (
      <article className="admin-inquiry-detail" aria-live="polite">
        <div className="admin-inquiry-detail__header">
          <div>
            <p className="eyebrow">Detalle</p>
            <h3>{selectedUser.nombre}</h3>
            <p>{selectedUser.email}</p>
          </div>
          <span className={getStatusPillClassName(selectedUser.estado)}>{selectedUser.estado}</span>
        </div>

        <dl className="admin-inquiry-detail__grid">
          <div><dt>Nombre</dt><dd>{selectedUser.nombre}</dd></div>
          <div><dt>Email</dt><dd>{selectedUser.email}</dd></div>
          <div><dt>Teléfono</dt><dd>{selectedUser.telefono || 'Sin teléfono'}</dd></div>
          <div><dt>Empresa</dt><dd>{selectedUser.empresa || 'Sin empresa'}</dd></div>
          <div><dt>CUIT</dt><dd>{selectedUser.cuit || 'Sin CUIT'}</dd></div>
          <div><dt>Localidad</dt><dd>{selectedUser.localidad || 'Sin localidad'}</dd></div>
          <div><dt>Cargo</dt><dd>{selectedUser.cargo || 'Sin cargo informado'}</dd></div>
          <div><dt>Rol</dt><dd>{selectedUser.rol}</dd></div>
          <div><dt>Estado</dt><dd>{selectedUser.estado}</dd></div>
          <div><dt>Fecha de creación</dt><dd>{formatDate(selectedUser.fechaCreacion)}</dd></div>
          <div><dt>Fecha de actualización</dt><dd>{formatDate(selectedUser.fechaActualizacion)}</dd></div>
        </dl>
      </article>
    );
  }

  return (
    <AdminLayout currentPath={currentPath}>
      <section className="admin-page-heading admin-machines-heading">
        <div>
          <p className="eyebrow">Usuarios</p>
          <h1>Gestión de usuarios</h1>
          <p>Revisá los usuarios creados desde solicitudes aprobadas y administrá su estado.</p>
        </div>
      </section>

      {loadError ? <p className="status-message status-message--error">{loadError}</p> : null}
      {actionError ? <p className="status-message status-message--error">{actionError}</p> : null}
      {saveMessage ? <p className="admin-save-message">{saveMessage}</p> : null}

      <section className="admin-card" aria-labelledby="admin-user-filters-title">
        <div className="admin-section-heading">
          <p className="eyebrow">Filtros</p>
          <h2 id="admin-user-filters-title">Buscar usuarios</h2>
        </div>

        <div className="admin-inquiry-filters">
          <label>
            <span className="admin-field-label">Estado</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value={allStatusesFilterValue}>Todos</option>
              {statuses.map((status) => <option value={status} key={status}>{status}</option>)}
            </select>
          </label>

          <label className="admin-form-field--wide">
            <span className="admin-field-label">Texto libre</span>
            <input
              type="search"
              placeholder="Nombre, email, teléfono, empresa, CUIT, localidad o rol"
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
        <article className="admin-card" aria-labelledby="admin-users-list-title">
          <div className="admin-section-heading admin-inquiries-list-heading">
            <div>
              <p className="eyebrow">Listado</p>
              <h2 id="admin-users-list-title">Usuarios registrados</h2>
            </div>
            <span>{filteredUsers.length} resultado(s)</span>
          </div>

          {isLoading ? (
            <p className="status-message">Cargando usuarios...</p>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-machines-table admin-users-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Empresa</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Fecha de creación</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className={selectedUser?.id === user.id ? 'is-selected' : undefined}>
                      <td data-label="Nombre"><strong>{user.nombre}</strong></td>
                      <td data-label="Email">{user.email}</td>
                      <td data-label="Teléfono">{user.telefono || '-'}</td>
                      <td data-label="Empresa">{user.empresa || '-'}</td>
                      <td data-label="Rol">{user.rol}</td>
                      <td data-label="Estado"><span className={getStatusPillClassName(user.estado)}>{user.estado}</span></td>
                      <td data-label="Fecha de creación">{formatDate(user.fechaCreacion)}</td>
                      <td data-label="Acciones">
                        <div className="admin-table-actions admin-inquiry-actions admin-user-actions">
                          <button className="admin-button admin-button--secondary" type="button" onClick={() => setSelectedUserId(user.id)}>
                            Ver detalle
                          </button>
                          {statuses.map((status) => (
                            <button
                              className={status === 'Inactivo' ? 'admin-button admin-button--danger' : 'admin-button admin-button--secondary'}
                              type="button"
                              key={status}
                              onClick={() => handleStatusChange(user.id, status)}
                              disabled={updatingUserId === user.id || user.estado === status}
                            >
                              {status === 'Activo' ? 'Activar' : 'Inactivar'}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 ? (
                    <tr><td colSpan="8">No hay usuarios que coincidan con los filtros aplicados.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <aside className="admin-card admin-inquiry-detail-card" aria-labelledby="admin-user-detail-title">
          <div className="admin-section-heading">
            <p className="eyebrow">Acción</p>
            <h2 id="admin-user-detail-title">Ver detalle</h2>
          </div>
          {renderDetail()}
        </aside>
      </section>
    </AdminLayout>
  );
}

export default AdminUsersPage;
