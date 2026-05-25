import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { T } from './T';

export default function Navbar() {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isAdmin = location.pathname.startsWith('/admin');
  if (isAdmin) return null;

  const closeMenu = () => setIsMenuOpen(false);

  // Close menu on route change
  useEffect(() => {
    closeMenu();
  }, [location.pathname]);

  // Close menu on outside click
  useEffect(() => {
    if (!isMenuOpen) return;
    const handler = (e) => {
      if (!e.target.closest('.navbar')) {
        closeMenu();
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [isMenuOpen]);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo */}
        <Link to="/" className="nav-logo" onClick={closeMenu}>
          <img src="/logo-atlas.png" alt="AtlasConcours Logo" className="logo-img" />
        </Link>

        {/* Desktop nav links */}
        <ul className="nav-links desktop-nav">
          <li>
            <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
              <T fr="Accueil" arKey="nav_home" />
            </Link>
          </li>
          <li>
            <Link to="/concours" className={location.pathname.startsWith('/concours') ? 'active' : ''}>
              <T fr="Concours" arKey="nav_concours" />
            </Link>
          </li>
          <li>
            <Link to="/jobs" className={location.pathname.startsWith('/jobs') ? 'active' : ''}>
              <T fr="Emplois" arKey="nav_emplois" />
            </Link>
          </li>
          <li>
            <Link to="/blog" className={location.pathname === '/blog' ? 'active' : ''}>
              <T fr="Blog" arKey="nav_blog" />
            </Link>
          </li>
        </ul>

        {/* Hamburger button — mobile only */}
        <button
          className="menu-btn"
          aria-label={isMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen(prev => !prev)}
        >
          <i className={isMenuOpen ? 'fas fa-times' : 'fas fa-bars'} />
        </button>
      </div>

      {/* Mobile dropdown — rendered outside navbar-container so it can span full width */}
      {isMenuOpen && (
        <div className="mobile-nav-overlay" role="navigation" aria-label="Menu mobile">
          <ul className="mobile-nav-links">
            <li>
              <Link to="/" className={location.pathname === '/' ? 'active' : ''} onClick={closeMenu}>
                <T fr="Accueil" arKey="nav_home" />
              </Link>
            </li>
            <li>
              <Link to="/concours" className={location.pathname.startsWith('/concours') ? 'active' : ''} onClick={closeMenu}>
                <T fr="Concours" arKey="nav_concours" />
              </Link>
            </li>
            <li>
              <Link to="/jobs" className={location.pathname.startsWith('/jobs') ? 'active' : ''} onClick={closeMenu}>
                <T fr="Emplois" arKey="nav_emplois" />
              </Link>
            </li>
            <li>
              <Link to="/blog" className={location.pathname === '/blog' ? 'active' : ''} onClick={closeMenu}>
                <T fr="Blog" arKey="nav_blog" />
              </Link>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}
