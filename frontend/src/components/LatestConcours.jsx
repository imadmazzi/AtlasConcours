import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { T } from './T';

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

export default function LatestConcours() {
  const [concours, setConcours] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/concours?limit=6').then(res => {
      setConcours(Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <section className="section">
      <div className="container">
        <div className="section-header">
          <h2>Derniers <span className="accent">Concours</span></h2>
          <Link to="/concours" className="section-link">Voir tous les concours →</Link>
        </div>
        {loading && <div className="loading"><div className="loading-spinner"></div><p>Chargement...</p></div>}
        {!loading && concours.length === 0 && <div className="empty-state"><i className="fa fa-clipboard-list"></i><p>Aucun concours disponible.</p></div>}
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
                  <i className="fa fa-calendar"></i>
                  Limite: {formatDate(c.date_limite)}
                </div>
                <Link to={`/concours/${c.id}`} className="btn-primary">
                  <T fr="Lire la suite" arKey="btn_read_more" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
