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

function extractJobData(html) {
  if (!html) return {};
  const text = html.replace(/<[^>]*>?/gm, ' ');
  const extractMatch = (regex) => {
    const match = text.match(regex);
    return match ? match[1].trim().replace(/\s+/g, ' ') : null;
  };
  return {
    postes: extractMatch(/(?:Nombre de postes|Postes)\s*[:\-]?\s*(\d{1,4})/i),
    grade: extractMatch(/(?:Grade|Échelle)\s*[:\-]?\s*([^\n\.<]{2,50})/i),
  };
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

  const extracted = extractJobData(concours.description);

  return (
    <main className="page-job-detail">
      {/* HEADER HERO */}
      <div className="page-header" style={{ padding: '60px 0', background: 'var(--primary-dark)' }}>
        <div className="container">
          <div className="breadcrumb" style={{ marginBottom: '24px' }}>
            <Link to="/">Accueil</Link>
            <span className="sep">›</span>
            <Link to="/concours">Concours</Link>
            <span className="sep">›</span>
            <span className="current">Détails du concours</span>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <span className="badge badge-general" style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
              Réf: {concours.id || 'N/A'}
            </span>
            <span className={getBadge(concours.categorie)} style={{ background: 'var(--accent)', color: 'white' }}>
              {concours.categorie || 'Secteur Public'}
            </span>
          </div>

          <h1 style={{ fontSize: '36px', marginBottom: '24px', lineHeight: '1.2' }}>{concours.titre}</h1>
          
          <div className="page-header-meta" style={{ gap: '24px' }}>
            {concours.organisme && (
              <div className="meta-item" style={{ fontSize: '16px' }}>
                <i className="fa fa-building"></i>
                <strong>{concours.organisme}</strong>
              </div>
            )}
            <div className="meta-item" style={{ fontSize: '16px', color: 'var(--accent)' }}>
              <i className="fa fa-calendar-alt"></i>
              Postuler avant le: <strong>{formatDate(concours.date_limite)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="container" style={{ padding: '40px 24px 80px' }}>
        <div className="detail-layout">
          {/* MAIN CONTENT */}
          <div className="detail-main" style={{ display: 'flex', flexDirection: 'column', gap: '30px', padding: 0, border: 'none', background: 'transparent' }}>
            
            {/* STRUCTURED OVERVIEW */}
            {(extracted.postes || extracted.grade) && (
              <div className="card" style={{ padding: '30px' }}>
                <h2 style={{ fontSize: '20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="fa fa-list-alt" style={{ color: 'var(--primary)' }}></i>
                  Résumé du concours
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                  {extracted.postes && (
                    <div>
                      <span style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Nombre de postes</span>
                      <strong>{extracted.postes}</strong>
                    </div>
                  )}
                  {extracted.grade && (
                    <div>
                      <span style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Grade</span>
                      <strong>{extracted.grade}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* FULL DESCRIPTION */}
            <div className="card" style={{ padding: '40px 30px' }}>
              <h2 style={{ fontSize: '22px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                Détails Officiels
              </h2>
              <div
                className="detail-content"
                style={{ fontSize: '16px', lineHeight: '1.9', color: 'var(--text)' }}
                dangerouslySetInnerHTML={{ __html: concours.description || '<p>Aucune description disponible.</p>' }}
              />
            </div>
          </div>

          {/* SIDEBAR */}
          <aside className="detail-sidebar" style={{ gap: '24px' }}>
            {/* PRIMARY CTA */}
            <div className="card cta-card-sticky">
              <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Intéressé(e) par ce concours ?</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                Veuillez consulter le dossier officiel et soumettre votre candidature avant le <strong>{formatDate(concours.date_limite)}</strong>.
              </p>
              
              {concours.lien_source ? (
                <a href={concours.lien_source} target="_blank" rel="noreferrer" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '16px', fontSize: '16px', borderRadius: '12px', marginBottom: '16px' }}>
                  Voir l'offre officielle
                  <i className="fa fa-external-link-alt" style={{ marginLeft: '8px' }}></i>
                </a>
              ) : (
                <div style={{ background: '#fee2e2', color: '#dc2626', padding: '12px', borderRadius: '8px', textAlign: 'center', fontSize: '14px', marginBottom: '16px' }}>
                  Lien officiel indisponible
                </div>
              )}

              <Link to="/concours" className="btn-outline" style={{ width: '100%', justifyContent: 'center' }}>
                ← Retour
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
