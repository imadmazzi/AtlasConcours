import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { T } from './T';

function formatDate(d) {
  if (!d) return 'N/A';
  const date = new Date(d);
  return isNaN(date) ? d : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function LatestEmplois() {
  const [emplois, setEmplois] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/emplois?limit=6').then(res => {
      setEmplois(Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <section className="section" style={{ background: '#fff', paddingTop: 60, paddingBottom: 60 }}>
      <div className="container">
        <div className="section-header">
          <h2>Offres d'<span className="accent">Emploi</span> Récentes</h2>
          <Link to="/jobs" className="section-link">Voir toutes les offres →</Link>
        </div>
        {loading && <div className="loading"><div className="loading-spinner"></div><p>Chargement...</p></div>}
        {!loading && emplois.length === 0 && <div className="empty-state"><i className="fa fa-briefcase"></i><p>Aucune offre disponible.</p></div>}
        <div className="cards-grid">
          {!loading && emplois.map(e => (
            <div key={e.id} className="card">
              <div className="card-top">
                <span className="badge badge-administration">{e.organisme || e.categorie || 'Emploi'}</span>
              </div>
              <h3>{e.titre}</h3>
              <p className="card-body">
                {(e.description || '').replace(/<[^>]*>/g, '').substring(0, 120)}...
              </p>
              <div className="card-footer">
                <div className="card-date">
                  <i className="fa fa-calendar"></i>
                  {formatDate(e.date_limite || e.deadline)}
                </div>
                <Link to={`/jobs/${e.id}`} className="btn-primary">
                  <T fr="Voir l'offre" arKey="btn_view_offer" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
