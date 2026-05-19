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

  return (
    <main>
      <div className="page-header">
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">Accueil</Link>
            <span className="sep">›</span>
            <Link to="/jobs">Emplois</Link>
            <span className="sep">›</span>
            <span className="current">{job.titre}</span>
          </div>
          <div style={{ marginBottom: 14 }}>
            <span className="badge badge-administration">{job.organisme || job.categorie || 'Emploi'}</span>
          </div>
          <h1>{job.titre}</h1>
          <div className="page-header-meta">
            {(job.entreprise || job.organisme) && (
              <div className="meta-item"><i className="fa fa-building"></i>{job.entreprise || job.organisme}</div>
            )}
            <div className="meta-item">
              <i className="fa fa-calendar"></i>Limite: {formatDate(job.date_limite || job.deadline)}
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="detail-layout">
          <div className="detail-main">
            <div
              className="detail-content"
              dangerouslySetInnerHTML={{ __html: safeContent }}
            />
          </div>

          <aside className="detail-sidebar">
            <div className="sidebar-card">
              <h3><i className="fa fa-info-circle" style={{ marginRight: 8 }}></i>Informations</h3>
              {(job.entreprise || job.organisme) && (
                <div className="info-row">
                  <i className="fa fa-building"></i>
                  <div><strong>Organisme / Entreprise</strong><span>{job.entreprise || job.organisme}</span></div>
                </div>
              )}
              <div className="info-row">
                <i className="fa fa-calendar"></i>
                <div><strong>Date limite</strong><span>{formatDate(job.date_limite || job.deadline)}</span></div>
              </div>
              {(job.localisation || job.ville) && (
                <div className="info-row">
                  <i className="fa fa-map-marker-alt"></i>
                  <div><strong>Lieu de travail</strong><span>{job.localisation || job.ville}</span></div>
                </div>
              )}
            </div>

            {(job.lien_candidature || job.lien) && (
              <div className="sidebar-card">
                <h3><i className="fa fa-file-alt" style={{ marginRight: 8 }}></i>Postuler</h3>
                <a href={job.lien_candidature || job.lien} target="_blank" rel="noreferrer" className="apply-btn">
                  <i className="fa fa-external-link-alt" style={{ marginRight: 8 }}></i>
                  Voir l'offre officielle
                </a>
              </div>
            )}

            <div className="sidebar-card">
              <button 
                onClick={() => {
                  if (window.history.length > 2) navigate(-1);
                  else navigate('/jobs');
                }} 
                className="btn-outline" 
                style={{ width: '100%', justifyContent: 'center' }}
              >
                ← Retour aux offres
              </button>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
