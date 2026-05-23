import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import api from '../api';

function formatDate(d) {
  if (!d || d === 'N/A') return "Consulter l'annonce";
  const date = new Date(d);
  return isNaN(date) ? d : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function cleanJobHTML(rawHtml, aiContent) {
  if (aiContent && aiContent.trim() !== '') {
    // If AI rewritten content is present, prioritize it. Sanitize just in case.
    return DOMPurify.sanitize(aiContent);
  }

  if (!rawHtml) return '<p>Aucune description disponible.</p>';

  // Clean basic noise via regex
  let cleaned = rawHtml;
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  cleaned = cleaned.replace(/Get Adobe Flash player/gi, '');
  cleaned = cleaned.replace(/Adobe Flash/gi, '');

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleaned, 'text/html');
    
    // Remove typical noise tags if they slipped in from ANAPEC/Emploi-public
    const noisySelectors = [
      'nav', 'header', 'footer', '.menu', '#menu', '.navigation',
      'a[href*="home"]', 'a[href*="contact"]', 'iframe'
    ];
    noisySelectors.forEach(selector => {
      doc.querySelectorAll(selector).forEach(el => el.remove());
    });

    cleaned = doc.body.innerHTML;
  } catch (e) {
    console.error("DOMParser error", e);
  }

  return DOMPurify.sanitize(cleaned, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span', 'table', 'thead', 'tbody', 'tr', 'td', 'th'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style']
  });
}

function extractJobData(html) {
  if (!html) return {};
  
  // Strip tags for easier regex matching
  const text = html.replace(/<[^>]*>?/gm, ' ');
  
  const extractMatch = (regex) => {
    const match = text.match(regex);
    return match ? match[1].trim().replace(/\s+/g, ' ') : null;
  };

  return {
    contrat: extractMatch(/(?:Type de contrat|Contrat)\s*[:\-]?\s*([^\n\.<]{2,50})/i),
    salaire: extractMatch(/(?:Salaire|Rémunération)\s*[:\-]?\s*([^\n\.<]{2,50})/i),
    experience: extractMatch(/(?:Expérience(?: professionnelle)?)\s*[:\-]?\s*([^\n\.<]{2,50})/i),
    formation: extractMatch(/(?:Formation|Diplôme)\s*[:\-]?\s*([^\n\.<]{2,100})/i),
  };
}

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get('/emplois/' + id).then(res => {
      setJob(res.data);
      setLoading(false);
    }).catch(() => { setError(true); setLoading(false); });
  }, [id]);

  if (loading) return <div className="loading" style={{ paddingTop: 80 }}><div className="loading-spinner"></div><p>Chargement...</p></div>;
  if (error || !job) return (
    <div className="empty-state" style={{ paddingTop: 80 }}>
      <i className="fa fa-exclamation-triangle"></i>
      <p>Offre introuvable.</p>
      <button onClick={() => navigate('/jobs')} className="btn-primary" style={{ marginTop: 20 }}>← Retour aux offres</button>
    </div>
  );

  const safeContent = cleanJobHTML(job.description, job.ai_rewritten);
  const extracted = extractJobData(job.description);

  return (
    <main className="page-job-detail">
      {/* HEADER HERO */}
      <div className="page-header" style={{ padding: '60px 0', background: 'var(--primary-dark)' }}>
        <div className="container">
          <div className="breadcrumb" style={{ marginBottom: '24px' }}>
            <Link to="/">Accueil</Link>
            <span className="sep">›</span>
            <Link to="/jobs">Emplois</Link>
            <span className="sep">›</span>
            <span className="current">Détails de l'offre</span>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <span className="badge badge-general" style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
              Réf: {job.id || 'N/A'}
            </span>
            <span className="badge badge-administration" style={{ background: 'var(--accent)', color: 'white' }}>
              {job.organisme || job.categorie || 'Secteur Public / Privé'}
            </span>
            {extracted.contrat && (
              <span className="badge badge-securite" style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
                <i className="fa fa-file-contract" style={{ marginRight: '6px' }}></i>
                {extracted.contrat}
              </span>
            )}
          </div>

          <h1 style={{ fontSize: '36px', marginBottom: '24px', lineHeight: '1.2' }}>{job.titre}</h1>
          
          <div className="page-header-meta" style={{ gap: '24px' }}>
            {(job.entreprise || job.organisme) && (
              <div className="meta-item" style={{ fontSize: '16px' }}>
                <i className="fa fa-building"></i>
                <strong>{job.entreprise || job.organisme}</strong>
              </div>
            )}
            {(job.localisation || job.ville) && (
              <div className="meta-item" style={{ fontSize: '16px' }}>
                <i className="fa fa-map-marker-alt"></i>
                {job.localisation || job.ville}
              </div>
            )}
            <div className="meta-item" style={{ fontSize: '16px', color: 'var(--accent)' }}>
              <i className="fa fa-calendar-alt"></i>
              Postuler avant le: <strong>{formatDate(job.date_limite || job.deadline)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="container" style={{ padding: '40px 24px 80px' }}>
        <div className="detail-layout">
          {/* MAIN CONTENT */}
          <div className="detail-main" style={{ display: 'flex', flexDirection: 'column', gap: '30px', padding: 0, border: 'none', background: 'transparent' }}>
            
            {/* STRUCTURED OVERVIEW */}
            {(extracted.salaire || extracted.experience || extracted.formation) && (
              <div className="card" style={{ padding: '30px' }}>
                <h2 style={{ fontSize: '20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="fa fa-list-alt" style={{ color: 'var(--primary)' }}></i>
                  Résumé de l'offre
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                  {extracted.salaire && (
                    <div>
                      <span style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Salaire</span>
                      <strong>{extracted.salaire}</strong>
                    </div>
                  )}
                  {extracted.experience && (
                    <div>
                      <span style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Expérience</span>
                      <strong>{extracted.experience}</strong>
                    </div>
                  )}
                  {extracted.formation && (
                    <div>
                      <span style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Formation requise</span>
                      <strong>{extracted.formation}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* FULL DESCRIPTION */}
            <div className="card" style={{ padding: '40px 30px' }}>
              <h2 style={{ fontSize: '22px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                Description du poste
              </h2>
              <div
                className="detail-content"
                style={{ fontSize: '16px', lineHeight: '1.9', color: 'var(--text)' }}
                dangerouslySetInnerHTML={{ __html: safeContent }}
              />
            </div>
          </div>

          {/* SIDEBAR */}
          <aside className="detail-sidebar" style={{ gap: '24px' }}>
            {/* PRIMARY CTA */}
            <div className="card cta-card-sticky">
              <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Intéressé(e) par cette offre ?</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                Préparez votre CV et postulez directement sur le site officiel avant le <strong>{formatDate(job.date_limite || job.deadline)}</strong>.
              </p>
              
              {job.lien_candidature || job.lien ? (
                <a href={job.lien_candidature || job.lien} target="_blank" rel="noreferrer" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '16px', fontSize: '16px', borderRadius: '12px', marginBottom: '16px' }}>
                  Voir l'offre officielle
                  <i className="fa fa-external-link-alt" style={{ marginLeft: '8px' }}></i>
                </a>
              ) : (
                <div style={{ background: '#fee2e2', color: '#dc2626', padding: '12px', borderRadius: '8px', textAlign: 'center', fontSize: '14px', marginBottom: '16px' }}>
                  Lien de candidature indisponible
                </div>
              )}

              <button 
                onClick={() => {
                  if (window.history.length > 2) navigate(-1);
                  else navigate('/jobs');
                }} 
                className="btn-outline" 
                style={{ width: '100%', justifyContent: 'center' }}
              >
                ← Retour
              </button>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
