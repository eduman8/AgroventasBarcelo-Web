const adminNavItems = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Maquinarias', href: '/admin/maquinarias' },
  { label: 'Usuarios', href: '/admin/usuarios' },
  { label: 'Consultas', href: '/admin/consultas' },
  { label: 'Solicitudes', href: '/admin/solicitudes-acceso' },
  { label: 'Configuración', href: '/admin/configuracion' }
];

function AdminLayout({ children, currentPath = '/admin' }) {
  return (
    <section className="admin-shell">
      <aside className="admin-sidebar" aria-label="Navegación administrativa">
        <a className="admin-sidebar__brand" href="/admin" aria-label="AgroBarceló Admin - Dashboard">
          <span className="admin-sidebar__mark">AB</span>
          <span>
            <strong>AgroBarceló</strong>
            <small>Administración</small>
          </span>
        </a>

        <nav className="admin-nav">
          {adminNavItems.map((item) => (
            <a
              className={item.href === currentPath ? 'is-active' : undefined}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      <div className="admin-panel">
        <header className="admin-topbar">
          <div>
            <p className="admin-topbar__eyebrow">Panel privado</p>
            <strong>Gestión AgroBarceló</strong>
          </div>
          <span className="admin-topbar__status">Sin autenticación · Fase 1</span>
        </header>

        <main className="admin-content">{children}</main>
      </div>
    </section>
  );
}

export default AdminLayout;
