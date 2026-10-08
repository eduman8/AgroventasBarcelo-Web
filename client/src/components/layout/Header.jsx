import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { navigationItems } from '../../config/navigation.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Logo from '../ui/Logo.jsx';

function Header({ currentPath = '/' }) {
  const { isAdmin, isAuthenticated, logout, user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const headerRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (isMenuOpen && !headerRef.current?.contains(event.target)) setIsMenuOpen(false);
    }
    function handleEscape(event) {
      if (event.key === 'Escape') setIsMenuOpen(false);
    }
    document.addEventListener('pointerdown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMenuOpen]);

  function handleLogout() {
    setIsMenuOpen(false);
    logout();
    if (currentPath.startsWith('/admin')) {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }

  return (
    <header className="site-header" ref={headerRef}>
      <div className="site-header__inner">
        <a className="brand" href="/" aria-label="AgroBarceló - Inicio">
          <Logo variant="header" />
        </a>

        <button
          className="site-menu-toggle"
          type="button"
          aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={isMenuOpen}
          aria-controls="site-main-nav"
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <nav id="site-main-nav" className={`main-nav${isMenuOpen ? ' is-open' : ''}`} aria-label="Navegación principal">
          <div className="main-nav__links">
            {navigationItems.filter((item) => !item.authOnly || isAuthenticated).map((item) => (
              <a
                className={item.href === currentPath ? 'is-active' : undefined}
                key={item.label}
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
            {isAdmin ? (
              <a className={currentPath.startsWith('/admin') ? 'is-active' : undefined} href="/admin" onClick={() => setIsMenuOpen(false)}>
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
              <a className={currentPath === '/login' ? 'is-active' : undefined} href="/login" onClick={() => setIsMenuOpen(false)}>
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
