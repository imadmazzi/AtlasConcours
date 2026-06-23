import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isAdmin = location.pathname.startsWith('/admin');
  if (isAdmin) return null;

  const toggleLang = () => {
    const currentLang = i18n.language || 'fr';
    const newLang = currentLang.startsWith('ar') ? 'fr' : 'ar';
    i18n.changeLanguage(newLang);
  };

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
              {t('nav.home')}
            </Link>
          </li>
          <li>
            <Link to="/concours" className={location.pathname.startsWith('/concours') ? 'active' : ''}>
              {t('nav.concours')}
            </Link>
          </li>
          <li>
            <Link to="/jobs" className={location.pathname.startsWith('/jobs') ? 'active' : ''}>
              {t('nav.jobs')}
            </Link>
          </li>
          <li>
            <Link to="/blog" className={location.pathname === '/blog' ? 'active' : ''}>
              {t('nav.blog')}
            </Link>
          </li>
        </ul>

        {/* Action Buttons (Switcher + Mobile Toggle) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button 
            onClick={toggleLang} 
            className="lang-switcher" 
            style={{
              background: 'var(--primary)',
              border: 'none',
              borderRadius: '20px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '14px',
              color: '#ffffff',
              boxShadow: 'var(--shadow-sm)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '70px'
            }}
          >
            {i18n.language?.startsWith('ar') ? 'FR' : 'عربية'}
          </button>

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
      </div>

      {/* Mobile dropdown — rendered outside navbar-container so it can span full width */}
      {isMenuOpen && (
        <div className="mobile-nav-overlay" role="navigation" aria-label="Menu mobile">
          <ul className="mobile-nav-links">
            <li>
              <Link to="/" className={location.pathname === '/' ? 'active' : ''} onClick={closeMenu}>
                {t('nav.home')}
              </Link>
            </li>
            <li>
              <Link to="/concours" className={location.pathname.startsWith('/concours') ? 'active' : ''} onClick={closeMenu}>
                {t('nav.concours')}
              </Link>
            </li>
            <li>
              <Link to="/jobs" className={location.pathname.startsWith('/jobs') ? 'active' : ''} onClick={closeMenu}>
                {t('nav.jobs')}
              </Link>
            </li>
            <li>
              <Link to="/blog" className={location.pathname === '/blog' ? 'active' : ''} onClick={closeMenu}>
                {t('nav.blog')}
              </Link>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}
