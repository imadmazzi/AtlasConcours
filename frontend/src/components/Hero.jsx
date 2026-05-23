import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { T } from './T';

export default function Hero() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/stats').then(res => setStats(res.data)).catch(() => {});
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('categorie', category);
    navigate('/concours?' + params.toString());
  };

  return (
    <section className="hero">
      <div className="hero-badge">
        <i className="fa fa-star"></i>
        N°1 des Concours Publics au Maroc
      </div>
      <h1>
        Trouvez les derniers
        <span className="accent">Concours au Maroc</span>
      </h1>
      <p>Tous les concours publics, offres d'emploi et conseils carrière en un seul endroit.</p>

      <form className="hero-search" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Chercher un concours, un ministère..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">Toutes catégories</option>
          <option value="Sécurité">Sécurité</option>
          <option value="Éducation">Éducation</option>
          <option value="Santé">Santé</option>
          <option value="Justice">Justice</option>
          <option value="Ingénierie">Ingénierie</option>
          <option value="Administration">Administration</option>
        </select>
        <button type="submit">
          <i className="fa fa-search"></i> Rechercher
        </button>
      </form>

      <div className="hero-ctas">
        <Link to="/concours" className="hero-cta btn-primary">
          <i className="fa fa-building"></i> Concours Publics
        </Link>
        <Link to="/jobs" className="hero-cta btn-outline-white">
          <i className="fa fa-briefcase"></i> Offres d'Emploi
        </Link>
      </div>

      <div className="hero-stats">
        <div className="stat-item">
          <span className="stat-num">{stats?.totaux?.concours ?? 0}</span>
          <span className="stat-label">Concours actifs</span>
        </div>
        <div className="stat-item">
          <span className="stat-num">{stats?.totaux?.emplois ?? 0}</span>
          <span className="stat-label">Offres d'emploi</span>
        </div>
        <div className="stat-item">
          <span className="stat-num">{stats?.totaux?.articles ?? 0}</span>
          <span className="stat-label">Articles</span>
        </div>
        <div className="stat-item">
          <span className="stat-num">{stats?.totaux?.vues ? `+${Math.floor(stats.totaux.vues/1000)}K` : '+0K'}</span>
          <span className="stat-label">Visiteurs/mois</span>
        </div>
      </div>
    </section>
  );
}
