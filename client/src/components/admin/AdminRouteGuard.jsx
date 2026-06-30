import { useAuth } from '../../context/AuthContext.jsx';

function AdminRouteGuard({ children }) {
  const { isAdmin, isAuthenticated, user } = useAuth();

  if (!isAdmin) {
    return (
      <main className="admin-access-denied" aria-labelledby="admin-access-denied-title">
        <section className="admin-access-denied__card">
          <p className="eyebrow">Panel privado</p>
          <h1 id="admin-access-denied-title">Acceso administrativo requerido</h1>
          {isAuthenticated ? (
            <>
              <p>
                La sesión de {user?.nombre || user?.email} no tiene permisos de administrador para ingresar al panel.
              </p>
              <a className="button button--primary" href="/">Volver al inicio</a>
            </>
          ) : (
            <>
              <p>Necesitás iniciar sesión con un usuario administrador activo para acceder al panel.</p>
              <a className="button button--primary" href="/login?redirect=/admin">Iniciar sesión</a>
            </>
          )}
        </section>
      </main>
    );
  }

  return children;
}

export default AdminRouteGuard;
