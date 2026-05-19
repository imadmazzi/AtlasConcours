import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { T } from './T';

export default function Navbar() {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const isAdmin = location.pathname.startsWith('/admin');
  if (isAdmin) return null;

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="nav-logo" onClick={closeMenu}>
          <img src="/logo-atlas.png" alt="AtlasConcours Logo" className="logo-img" />
        </Link>
        
        <div className="nav-links-wrapper">
          <button className="menu-btn" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <i className={isMenuOpen ? "fas fa-times" : "fas fa-bars"}></i>
          </button>

          <ul className={`nav-links ${isMenuOpen ? 'show' : ''}`}>
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
      </div>
    </nav>
  );
}
