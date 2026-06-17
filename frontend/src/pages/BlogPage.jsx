import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { T } from '../components/T';

export default function BlogPage() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/articles?limit=20').then(res => {
      setArticles(res.data.data || []);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  return (
    <main>
      <div className="page-hero">
        <div className="container">
          <h1>Blog <span style={{ color: 'var(--accent)' }}>& Conseils</span></h1>
          <p>Articles et conseils pour réussir vos concours au Maroc.</p>
        </div>
      </div>
      <div className="container" style={{ padding: '60px 0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <i className="fa fa-circle-notch fa-spin fa-2x"></i>
          </div>
        ) : articles.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#64748b' }}>
            <i className="fa fa-newspaper" style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}></i>
            <p>Articles en cours de rédaction...</p>
          </div>
        ) : (
          <div className="grid">
            {articles.map(article => (
              <div className="card" key={article.id}>
                <div className="card-body">
                  <div className="card-meta" style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    <i className="fa fa-calendar-alt"></i> {new Date(article.created_at).toLocaleDateString('fr-FR')}
                    <span style={{ marginLeft: '12px' }}><i className="fa fa-eye"></i> {article.vues || 0} vues</span>
                  </div>
                  <h2 className="card-title" style={{ fontSize: '18px', marginBottom: '12px' }}>
                    <Link to={`/blog/${article.slug}`}>{article.titre}</Link>
                  </h2>
                  <div className="card-tags" style={{ marginBottom: '16px' }}>
                    {article.tags.split(',').map((tag, idx) => (
                      <span key={idx} className="badge bg-light text-dark" style={{ marginRight: '6px' }}>{tag.trim()}</span>
                    ))}
                  </div>
                  <div dangerouslySetInnerHTML={{ __html: article.extrait + '...' }} style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6' }} />
                </div>
                <div className="card-footer">
                  <Link to={`/blog/${article.slug}`} className="btn-primary" style={{ width: '100%', display: 'block', textAlign: 'center', padding: '10px 0' }}>
                    Lire l'article
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
