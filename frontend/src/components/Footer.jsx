import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer>
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="footer-logo">
              <Link to="/">
                <img src="/logo-atlas.png" alt="AtlasConcours Logo" className="logo-img" />
              </Link>
            </div>
            <p className="footer-desc">
              La plateforme N°1 des concours publics et offres d'emploi au Maroc.
              Restez informé, postulez et réussissez votre carrière.
            </p>
          </div>
          <div className="footer-col">
            <h4>Navigation</h4>
            <Link to="/">Accueil</Link>
            <Link to="/concours">Concours</Link>
            <Link to="/jobs">Emplois</Link>
            <Link to="/blog">Blog</Link>
          </div>
          <div className="footer-col">
            <h4>Concours</h4>
            <Link to="/concours?categorie=Sécurité">Sécurité</Link>
            <Link to="/concours?categorie=Éducation">Éducation</Link>
            <Link to="/concours?categorie=Santé">Santé</Link>
            <Link to="/concours?categorie=Justice">Justice</Link>
          </div>
          <div className="footer-col">
            <h4>Contact</h4>
            <a href="mailto:contact@atlasconcours.ma">contact@atlasconcours.ma</a>
            <a href="https://t.me/atlasconcours" target="_blank" rel="noopener noreferrer">Telegram</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2026 AtlasConcours. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
}
