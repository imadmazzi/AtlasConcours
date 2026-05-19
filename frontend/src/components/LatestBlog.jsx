import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { T } from './T';

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  return isNaN(date) ? d : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function LatestBlog() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/articles?limit=3').then(res => {
      const data = res.data;
      setArticles(Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (!loading && articles.length === 0) return null;

  return (
    <section className="section">
      <div className="container">
        <div className="section-header">
          <h2>Derniers <span className="primary" style={{ color: 'var(--primary)' }}>Articles</span></h2>
          <Link to="/blog" className="section-link">Voir tous les articles →</Link>
        </div>
        {loading && <div className="loading"><div className="loading-spinner"></div><p>Chargement...</p></div>}
        <div className="cards-grid">
          {!loading && articles.map(a => (
            <div key={a.id} className="card">
              <div className="card-top">
                <span className="badge badge-general">{a.categorie || 'Conseils'}</span>
              </div>
              <h3>{a.titre}</h3>
              <p className="card-body">
                {(a.contenu || a.description || '').replace(/<[^>]*>/g, '').substring(0, 120)}...
              </p>
              <div className="card-footer">
                <div className="card-date">
                  <i className="fa fa-calendar"></i>
                  {formatDate(a.created_at)}
                </div>
                <Link to={`/blog/${a.id}`} className="btn-primary">
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
