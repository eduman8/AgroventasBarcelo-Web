import { useAuth } from '../../context/AuthContext.jsx';

const adminNavItems = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Maquinarias', href: '/admin/maquinarias' },
  { label: 'Usuarios', href: '/admin/usuarios' },
  { label: 'Consultas', href: '/admin/consultas' },
  { label: 'Solicitudes', href: '/admin/solicitudes-acceso' },
  { label: 'Configuración', href: '/admin/configuracion' }
];

function AdminLayout({ children, currentPath = '/admin' }) {
  const { user, logout } = useAuth();

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
          <div className="admin-topbar__session">
            <span className="admin-topbar__status">Sesión admin · {user?.email}</span>
            <button className="button button--secondary" type="button" onClick={logout}>Cerrar sesión</button>
          </div>
        </header>

        <main className="admin-content">{children}</main>
      </div>
    </section>
  );
}

export default AdminLayout;
