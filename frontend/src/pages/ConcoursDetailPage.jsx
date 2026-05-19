import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
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

export default function ConcoursDetailPage() {
  const { id } = useParams();
  const [concours, setConcours] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get('/concours/' + id).then(res => {
      setConcours(res.data);
      setLoading(false);
    }).catch(() => { setError(true); setLoading(false); });
  }, [id]);

  if (loading) return <div className="loading" style={{ paddingTop: 80 }}><div className="loading-spinner"></div><p>Chargement...</p></div>;
  if (error || !concours) return (
    <div className="empty-state" style={{ paddingTop: 80 }}>
      <i className="fa fa-exclamation-triangle"></i>
      <p>Concours introuvable.</p>
      <Link to="/concours" className="btn-primary" style={{ marginTop: 20 }}>← Retour aux concours</Link>
    </div>
  );

  return (
    <main>
      <div className="page-header">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">Accueil</Link>
            <span className="sep">›</span>
            <Link to="/concours">Concours</Link>
            <span className="sep">›</span>
            <span className="current">{concours.titre}</span>
          </div>
          <div style={{ marginBottom: 14 }}>
            <span className={getBadge(concours.categorie)}>{concours.categorie || 'Général'}</span>
          </div>
          <h1>{concours.titre}</h1>
          <div className="page-header-meta">
            {concours.organisme && (
              <div className="meta-item"><i className="fa fa-building"></i>{concours.organisme}</div>
            )}
            <div className="meta-item"><i className="fa fa-calendar"></i>Limite: {formatDate(concours.date_limite)}</div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="detail-layout">
          <div className="detail-main">
            <div
              className="detail-content"
              dangerouslySetInnerHTML={{ __html: concours.description || '<p>Aucune description disponible.</p>' }}
            />
          </div>

          <aside className="detail-sidebar">
            <div className="sidebar-card">
              <h3><i className="fa fa-info-circle" style={{ marginRight: 8 }}></i>Informations</h3>
              {concours.organisme && (
                <div className="info-row">
                  <i className="fa fa-building"></i>
                  <div><strong>Organisme</strong><span>{concours.organisme}</span></div>
                </div>
              )}
              <div className="info-row">
                <i className="fa fa-calendar"></i>
                <div><strong>Date limite</strong><span>{formatDate(concours.date_limite)}</span></div>
              </div>
              {concours.categorie && (
                <div className="info-row">
                  <i className="fa fa-tag"></i>
                  <div><strong>Catégorie</strong><span>{concours.categorie}</span></div>
                </div>
              )}
            </div>

            {concours.lien_source && (
              <div className="sidebar-card">
                <h3><i className="fa fa-file-alt" style={{ marginRight: 8 }}></i>Postuler</h3>
                <a href={concours.lien_source} target="_blank" rel="noreferrer" className="apply-btn">
                  <i className="fa fa-external-link-alt" style={{ marginRight: 8 }}></i>
                  Voir le dossier officiel
                </a>
              </div>
            )}

            <div className="sidebar-card">
              <h3><i className="fa fa-arrow-left" style={{ marginRight: 8 }}></i>Navigation</h3>
              <Link to="/concours" className="btn-outline" style={{ width: '100%', justifyContent: 'center' }}>
                ← Retour aux concours
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
