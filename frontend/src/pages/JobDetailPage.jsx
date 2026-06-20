import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import InlineFAQ, { buildJobFAQ } from '../components/InlineFAQ';

function formatDate(d) {
  if (!d || d === 'N/A') return "Consulter l'annonce";
  const date = new Date(d);
  return isNaN(date) ? d : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// cleanJobHTML removed as we no longer render raw HTML

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
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    if (job) {
      document.title = `${job.titre} 2026 - طريقة التسجيل والوثائق المطلوبة | AtlasConcours`;
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = "description";
        document.head.appendChild(metaDesc);
      }
      metaDesc.content = `اكتشف تفاصيل وشروط التسجيل في مباراة ${job.titre} 2026. كل ما تحتاج معرفته من الوثائق المطلوبة وآخر أجل للتقديم على موقع AtlasConcours.`;
    }
  }, [job]);

  useEffect(() => {
    setLoading(true);
    setError(false);
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

  // DOMPurify removed
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

            {/* Structured Data View */}
            <div className="card concours-desc-card">
              <h2 className="card-section-title" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 28 }}>
                <i className="fa fa-list-ul" style={{ color: 'var(--primary)', marginRight: 10 }}></i>
                Détails de l'offre
              </h2>

              <div className="structured-data-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="data-row" style={{ display: 'flex', flexWrap: 'wrap', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: '100%', maxWidth: '280px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Entreprise / Administration</div>
                  <div style={{ flex: 1, color: 'var(--text)', fontWeight: 700 }}>{job.entreprise || job.organisme || 'Non spécifié'}</div>
                </div>
                <div className="data-row" style={{ display: 'flex', flexWrap: 'wrap', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: '100%', maxWidth: '280px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Nom du Poste</div>
                  <div style={{ flex: 1, color: 'var(--text)', fontWeight: 700 }}>{job.titre || 'Non spécifié'}</div>
                </div>
                {extracted.contrat && (
                  <div className="data-row" style={{ display: 'flex', flexWrap: 'wrap', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: '100%', maxWidth: '280px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Type de contrat</div>
                    <div style={{ flex: 1, color: 'var(--text)', fontWeight: 700 }}>{extracted.contrat}</div>
                  </div>
                )}
                {extracted.formation && (
                  <div className="data-row" style={{ display: 'flex', flexWrap: 'wrap', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: '100%', maxWidth: '280px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Formation requise</div>
                    <div style={{ flex: 1, color: 'var(--text)', fontWeight: 700 }}>{extracted.formation}</div>
                  </div>
                )}
                <div className="data-row" style={{ display: 'flex', flexWrap: 'wrap', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: '100%', maxWidth: '280px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Localisation</div>
                  <div style={{ flex: 1, color: 'var(--text)', fontWeight: 700 }}>{job.localisation || job.ville || 'Maroc'}</div>
                </div>
                <div className="data-row" style={{ display: 'flex', flexWrap: 'wrap', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: '100%', maxWidth: '280px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Délai de dépôt</div>
                  <div style={{ flex: 1, color: 'var(--danger)', fontWeight: 800 }}>{formatDate(job.date_limite || job.deadline)}</div>
                </div>
              </div>

              {/* PDF / Apply Download CTA Section */}
              <div style={{ marginTop: '40px', background: '#f8fafc', padding: '32px 24px', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <div style={{ width: '56px', height: '56px', background: '#ef4444', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', margin: '0 auto 16px', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' }}>
                  <i className="fa fa-file-pdf"></i>
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', marginBottom: '12px' }}>Avis de l'offre officiel</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px' }}>
                  Téléchargez le document officiel ou consultez la page d'origine pour les détails complets et les modalités de candidature.
                </p>
                {job.lien_candidature || job.lien || job.pdf_url ? (
                  <a href={job.pdf_url || job.lien_candidature || job.lien} target="_blank" rel="noreferrer" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', padding: '16px 32px', fontSize: '16px', borderRadius: '12px', background: '#ef4444', border: 'none', boxShadow: '0 6px 16px rgba(239, 68, 68, 0.3)', transition: 'transform 0.2s, box-shadow 0.2s' }}>
                    <i className="fa fa-download" style={{ marginRight: '10px' }}></i>
                    Télécharger l'Arrêté du Concours (PDF)
                  </a>
                ) : (
                  <div className="cta-link-unavailable" style={{ display: 'inline-block' }}>
                    <i className="fa fa-exclamation-circle"></i> Document non disponible
                  </div>
                )}
              </div>
              {/* CONTEXTUAL FAQ */}
            <InlineFAQ
              items={buildJobFAQ(job, extracted)}
              title="أسئلة شائعة حول هذه الوظيفة"
            />

            {/* TAGS & KEYWORDS (SEO) */}
            <div className="card" style={{ marginTop: '30px', padding: '24px' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '16px', color: 'var(--text-muted)' }}>
                <i className="fa fa-tags" style={{ marginRight: '8px' }}></i>
                Mots-clés / الكلمات المفتاحية
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <Link to="/jobs" className="badge" style={{ background: '#f1f5f9', color: 'var(--text)', border: '1px solid #e2e8f0', textDecoration: 'none' }}>عروض العمل بالمغرب 2026</Link>
                <Link to="/jobs" className="badge" style={{ background: '#f1f5f9', color: 'var(--text)', border: '1px solid #e2e8f0', textDecoration: 'none' }}>التوظيف بالمغرب</Link>
                <Link to="/jobs" className="badge" style={{ background: '#f1f5f9', color: 'var(--text)', border: '1px solid #e2e8f0', textDecoration: 'none' }}>فرص عمل</Link>
                {job.categorie && (
                  <Link to="/jobs" className="badge" style={{ background: '#f1f5f9', color: 'var(--text)', border: '1px solid #e2e8f0', textDecoration: 'none' }}>قطاع {job.categorie}</Link>
                )}
                {(job.entreprise || job.organisme) && (
                  <Link to="/jobs" className="badge" style={{ background: '#f1f5f9', color: 'var(--text)', border: '1px solid #e2e8f0', textDecoration: 'none' }}>{job.entreprise || job.organisme}</Link>
                )}
              </div>
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
