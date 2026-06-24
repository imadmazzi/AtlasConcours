import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { T } from './T';
import useBilingual from '../hooks/useBilingual';

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
    <section className="section" style={{ background: '#fff', paddingTop: 60, paddingBottom: 60 }}>
      <div className="container">
        <div className="section-header">
          <h2>Derniers <span className="accent">Concours</span></h2>
          <Link to="/concours" className="section-link">Voir tous les concours →</Link>
        </div>
        {loading && <div className="loading"><div className="loading-spinner"></div><p>Chargement...</p></div>}
        {!loading && concours.length === 0 && <div className="empty-state"><i className="fa fa-clipboard-list"></i><p>Aucun concours disponible.</p></div>}
        <div className="cards-grid">
          {!loading && concours.map(c => {
            const bl = useBilingual(c); // eslint-disable-line react-hooks/rules-of-hooks
            return (
            <div key={c.id} className="card">
              <div className="card-top">
                <span className={getBadge(c.categorie)}>{c.categorie || 'Général'}</span>
              </div>
              <h3 style={{ display: 'flex', alignItems: 'center' }}>
                {c.imageUrl ? (
                  <img src={c.imageUrl} alt="" className="w-10 h-10 object-contain rounded-md bg-slate-100 mr-3 inline-block align-middle" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 6, backgroundColor: '#f1f5f9', marginRight: 12, flexShrink: 0 }} />
                ) : (
                  <div className="w-10 h-10 rounded-md flex items-center justify-center mr-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 8, backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', marginRight: 12, flexShrink: 0 }}>
                    <i className="fa fa-university text-blue-600 text-lg" style={{ fontSize: 18, color: '#2563eb' }}></i>
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
                  Limite: {formatDate(c.date_limite)}
                </div>
                <Link to={`/concours/${c.id}`} className="btn-primary">
                  <T fr="Lire la suite" arKey="btn_read_more" />
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
