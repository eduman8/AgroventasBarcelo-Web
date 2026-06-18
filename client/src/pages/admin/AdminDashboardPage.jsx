import { useEffect, useMemo, useState } from 'react';

import AdminLayout from '../../components/admin/AdminLayout.jsx';
import { emptyDashboard, getAdminDashboard } from '../../services/adminDashboardService.js';

function formatNumber(value) {
  return new Intl.NumberFormat('es-AR').format(Number(value ?? 0));
}

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

function AdminDashboardPage({ currentPath = '/admin' }) {
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setIsLoading(true);
      setLoadError('');

      try {
        const response = await getAdminDashboard();

        if (isMounted) {
          setDashboard(response);
        }
      } catch (currentError) {
        if (isMounted) {
          setLoadError(currentError.message);
          setDashboard(emptyDashboard);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const summaryCards = useMemo(() => [
    { group: 'Consultas', label: 'Total', value: dashboard.consultas.total, detail: 'Consultas registradas' },
    { group: 'Consultas', label: 'Nuevas', value: dashboard.consultas.nuevas, detail: 'Pendientes de primera revisión' },
    { group: 'Consultas', label: 'En proceso', value: dashboard.consultas.enProceso, detail: 'Casos en seguimiento' },
    { group: 'Consultas', label: 'Respondidas', value: dashboard.consultas.respondidas, detail: 'Ya tuvieron respuesta' },
    { group: 'Maquinarias', label: 'Total', value: dashboard.maquinarias.total, detail: 'Publicaciones activas' },
    { group: 'Maquinarias', label: 'Disponibles', value: dashboard.maquinarias.disponibles, detail: 'Unidades para consultar' },
    { group: 'Maquinarias', label: 'Vendidas', value: dashboard.maquinarias.vendidas, detail: 'Unidades cerradas' },
    { group: 'Repuestos', label: 'Total', value: dashboard.repuestos.total, detail: 'Artículos del catálogo SQL' }
  ], [dashboard]);

  return (
    <AdminLayout currentPath={currentPath}>
      <section className="admin-page-heading admin-dashboard-heading">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Centro de control administrativo</h1>
          <p>
            Vista inicial con métricas clave de consultas, maquinarias y repuestos almacenados en SQL Server.
          </p>
        </div>
        <div className="admin-dashboard-quick-actions" aria-label="Accesos rápidos">
          <a className="admin-button admin-button--primary" href="/admin/consultas">Centro de Consultas</a>
          <a className="admin-button admin-button--secondary" href="/admin/maquinarias">Administración de Maquinarias</a>
          <a className="admin-button admin-button--secondary" href="/repuestos">Administración de Repuestos</a>
        </div>
      </section>

      {loadError ? <p className="status-message status-message--error">{loadError}</p> : null}
      {isLoading ? <p className="status-message">Cargando dashboard administrativo...</p> : null}

      <section className="admin-summary-grid admin-dashboard-summary-grid" aria-label="Resumen del panel administrativo">
        {summaryCards.map((card) => (
          <article className="admin-summary-card" key={`${card.group}-${card.label}`}>
            <span>{card.group} · {card.label}</span>
            <strong>{formatNumber(card.value)}</strong>
            <p>{card.detail}</p>
          </article>
        ))}
      </section>

      <section className="admin-card admin-dashboard-latest-card">
        <div className="admin-section-heading">
          <p className="eyebrow">Seguimiento</p>
          <h2>Últimas consultas</h2>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-machines-table admin-dashboard-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.ultimasConsultas.length > 0 ? dashboard.ultimasConsultas.map((inquiry) => (
                <tr key={inquiry.id}>
                  <td>{formatDate(inquiry.fecha)}</td>
                  <td>{inquiry.nombre || 'Sin cliente'}</td>
                  <td>{inquiry.tipoConsulta || 'Sin tipo'}</td>
                  <td><span className={getStatusPillClassName(inquiry.estado)}>{inquiry.estado || 'Sin estado'}</span></td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="4">No hay consultas recientes para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminLayout>
  );
}

export default AdminDashboardPage;
