import { navigationItems } from '../../config/navigation.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Logo from '../ui/Logo.jsx';

function Header({ currentPath = '/' }) {
  const { isAuthenticated, logout, user } = useAuth();

  function handleLogout() {
    logout();
  }
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="brand" href="/" aria-label="AgroBarceló - Inicio">
          <Logo variant="header" />
        </a>

        <nav className="main-nav" aria-label="Navegación principal">
          {navigationItems.filter((item) => !item.authOnly || isAuthenticated).map((item) => (
            <a
              className={item.href === currentPath ? 'is-active' : undefined}
              key={item.label}
              href={item.href}
            >
              {item.label}
            </a>
          ))}
          {isAuthenticated ? (
            <button className="main-nav__button" type="button" onClick={handleLogout}>
              Salir ({user?.nombre || user?.email})
            </button>
          ) : (
            <a className={currentPath === '/login' ? 'is-active' : undefined} href="/login">
              Ingresar
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Header;
