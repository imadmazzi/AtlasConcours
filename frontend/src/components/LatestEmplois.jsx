import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { T } from './T';
import useBilingual from '../hooks/useBilingual';

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
          {!loading && emplois.map(e => {
            const bl = useBilingual(e); // eslint-disable-line react-hooks/rules-of-hooks
            return (
            <div key={e.id} className="card">
              <div className="card-top">
                <span className="badge badge-administration">{e.organisme || e.categorie || 'Emploi'}</span>
              </div>
              <h3 style={{ display: 'flex', alignItems: 'center' }}>
                {e.imageUrl ? (
                  <img src={e.imageUrl} alt="" className="w-10 h-10 object-contain rounded-md bg-slate-100 mr-3 inline-block align-middle" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 6, backgroundColor: '#f1f5f9', marginRight: 12, flexShrink: 0 }} />
                ) : (
                  <div className="w-10 h-10 rounded-md flex items-center justify-center mr-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 8, backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', marginRight: 12, flexShrink: 0 }}>
                    <i className="fa fa-briefcase text-green-600 text-lg" style={{ fontSize: 18, color: '#16a34a' }}></i>
                  </div>
                )}
                <span style={{ flex: 1 }}>{bl.titre}</span>
              </h3>
              <p className="card-body">
                {(bl.description || '').replace(/<[^>]*>/g, '').substring(0, 120)}...
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
          );
          })}
        </div>
      </div>
    </section>
  );
}
