import { useAuth } from '../../context/AuthContext.jsx';

function AdminRouteGuard({ children }) {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = isAuthenticated && user?.rol === 'Admin';

  if (!isAdmin) {
    return (
      <section className="admin-access-denied" aria-labelledby="admin-access-denied-title">
        <div className="login-card">
          <p className="eyebrow">Panel privado</p>
          <h1 id="admin-access-denied-title">Acceso administrativo requerido</h1>
          <p>Necesitás iniciar sesión con un usuario administrador activo para acceder al panel.</p>
          <a className="button button--primary" href="/login">Iniciar sesión</a>
        </div>
      </section>
    );
  }

  return children;
}

export default AdminRouteGuard;
