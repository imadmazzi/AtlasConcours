import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';

export default function ArticleDetailPage() {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/articles/${slug}`).then(res => {
      setArticle(res.data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [slug]);

  if (loading) {
    return (
      <main className="container" style={{ padding: '100px 0', textAlign: 'center' }}>
        <i className="fa fa-circle-notch fa-spin fa-3x" style={{ color: 'var(--primary)' }}></i>
      </main>
    );
  }

  if (!article) {
    return (
      <main className="container" style={{ padding: '100px 0', textAlign: 'center' }}>
        <h2>Article introuvable</h2>
        <Link to="/blog" className="btn-primary mt-3">Retour au blog</Link>
      </main>
    );
  }

  return (
    <main>
      <div className="page-hero">
        <div className="container">
          <h1 style={{ fontSize: '28px', maxWidth: '800px', margin: '0 auto' }}>{article.titre}</h1>
          <div style={{ marginTop: '20px', color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>
            <span><i className="fa fa-calendar-alt"></i> Publié le {new Date(article.created_at).toLocaleDateString('fr-FR')}</span>
            <span style={{ marginLeft: '20px' }}><i className="fa fa-eye"></i> {article.vues} vues</span>
          </div>
        </div>
      </div>
      
      <div className="container" style={{ padding: '60px 0', maxWidth: '800px' }}>
        <div className="card" style={{ padding: '40px' }}>
          <div className="article-body" dangerouslySetInnerHTML={{ __html: article.contenu }} />
          
          <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
            <h4 style={{ fontSize: '16px', marginBottom: '10px' }}>Mots-clés</h4>
            <div className="card-tags">
              {article.tags.split(',').map((tag, idx) => (
                <span key={idx} className="badge bg-light text-dark" style={{ marginRight: '8px' }}>{tag.trim()}</span>
              ))}
            </div>
          </div>
        </div>
        
        <div style={{ marginTop: '40px', textAlign: 'center' }}>
          <Link to="/blog" className="btn-outline">
            <i className="fa fa-arrow-left"></i> Retour aux articles
          </Link>
        </div>
      </div>
    </main>
  );
}
