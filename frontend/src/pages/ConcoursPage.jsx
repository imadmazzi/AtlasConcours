import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';

const BADGE_MAP = {
  'Sécurité': 'securite', 'Éducation': 'education', 'Santé': 'sante',
  'Justice': 'justice', 'Ingénierie': 'ingenierie', 'Administration': 'administration'
};

function getBadge(cat) { return 'badge badge-' + (BADGE_MAP[cat] || 'general'); }

function formatDate(d) {
  if (!d) return 'N/A';
  const date = new Date(d);
  return isNaN(date) ? d : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ConcoursPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [concours, setConcours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [categorie, setCategorie] = useState(searchParams.get('categorie') || '');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (categorie) params.set('categorie', categorie);
    params.set('limit', '50');
    api.get('/concours?' + params.toString()).then(res => {
      setConcours(Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [search, categorie]);

  const handleSearch = (e) => {
    e.preventDefault();
    const p = {};
    if (search) p.search = search;
    if (categorie) p.categorie = categorie;
    setSearchParams(p);
  };

  return (
    <main>
      <div className="page-hero">
        <div className="container">
          <h1>Tous les <span style={{ color: 'var(--accent)' }}>Concours</span></h1>
          <p>Retrouvez tous les concours publics au Maroc, mis à jour quotidiennement.</p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
        <form className="filters-bar" onSubmit={handleSearch}>
          <input
            className="filter-input"
            type="text"
            placeholder="Rechercher un concours, un ministère..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="filter-select" value={categorie} onChange={e => setCategorie(e.target.value)}>
            <option value="">Toutes catégories</option>
            <option value="Sécurité">Sécurité</option>
            <option value="Éducation">Éducation</option>
            <option value="Santé">Santé</option>
            <option value="Justice">Justice</option>
            <option value="Ingénierie">Ingénierie</option>
            <option value="Administration">Administration</option>
          </select>
          <button type="submit" className="btn-primary">
            <i className="fa fa-search"></i> Rechercher
          </button>
        </form>

        {!loading && (
          <p className="results-count">
            <strong>{concours.length}</strong> concours trouvés
          </p>
        )}

        {loading && <div className="loading"><div className="loading-spinner"></div><p>Chargement...</p></div>}
        {!loading && concours.length === 0 && (
          <div className="empty-state"><i className="fa fa-clipboard-list"></i><p>Aucun concours trouvé.</p></div>
        )}

        <div className="cards-grid">
          {!loading && concours.map(c => (
            <div key={c.id} className="card">
              <div className="card-top">
                <span className={getBadge(c.categorie)}>{c.categorie || 'Général'}</span>
              </div>
              <h3>{c.titre}</h3>
              <p className="card-body">
                {(c.description || '').replace(/<[^>]*>/g, '').substring(0, 120)}...
              </p>
              <div className="card-footer">
                <div className="card-date">
                  <i className="fa fa-calendar"></i> Limite: {formatDate(c.date_limite)}
                </div>
                <Link to={`/concours/${c.id}`} className="btn-primary">Lire la suite</Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
