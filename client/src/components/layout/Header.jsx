import { navigationItems } from '../../config/navigation.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Logo from '../ui/Logo.jsx';

function Header({ currentPath = '/' }) {
  const { isAdmin, isAuthenticated, logout, user } = useAuth();

  function handleLogout() {
    logout();
    if (currentPath.startsWith('/admin')) {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="brand" href="/" aria-label="AgroBarceló - Inicio">
          <Logo variant="header" />
        </a>

        <nav className="main-nav" aria-label="Navegación principal">
          <div className="main-nav__links">
            {navigationItems.filter((item) => !item.authOnly || isAuthenticated).map((item) => (
              <a
                className={item.href === currentPath ? 'is-active' : undefined}
                key={item.label}
                href={item.href}
              >
                {item.label}
              </a>
            ))}
            {isAdmin ? (
              <a className={currentPath.startsWith('/admin') ? 'is-active' : undefined} href="/admin">
                Panel admin
              </a>
            ) : null}
          </div>
          <div className="main-nav__account" aria-label="Cuenta">
            {isAuthenticated ? (
              <button className="main-nav__button" type="button" onClick={handleLogout}>
                Salir ({user?.nombre || user?.email})
              </button>
            ) : (
              <a className={currentPath === '/login' ? 'is-active' : undefined} href="/login">
                Ingresar
              </a>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}

export default Header;
