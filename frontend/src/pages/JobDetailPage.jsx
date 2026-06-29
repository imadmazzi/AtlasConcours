import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import InlineFAQ, { buildJobFAQ } from '../components/InlineFAQ';
import useBilingual from '../hooks/useBilingual';
import { useTranslation } from 'react-i18next';
import InfoCard from '../components/InfoCard';

function formatDate(d) {
  if (!d || d === 'N/A') return "Consulter l'annonce";
  const date = new Date(d);
  return isNaN(date) ? d : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
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
    formation: extractMatch(/(?:Formation|Diplôme|Niveau d'études)\s*[:\-]?\s*([^\n\.<]{2,100})/i),
    postes: extractMatch(/(?:Nombre\s+de\s+postes?|Postes?\s+ouverts?)\s*[:\-]?\s*(\d{1,4})/i),
    typeRecrutement: extractMatch(/(?:Type\s+de\s+recrutement|Type\s+de\s+concours|Recrutement)\s*[:\-]?\s*([^\n\.<]{2,50})/i),
    specialite: extractMatch(/(?:Spécialité|Option|Filière|Domaine)\s*[:\-]?\s*([^\n\.<]{2,50})/i)
  };
}

const stripHtml = (html) => html ? String(html).replace(/<[^>]*>?/gm, '').trim() : '';

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { i18n } = useTranslation();

  // Hook must be called unconditionally (Rules of Hooks)
  const bl = useBilingual(job);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    if (job) {
      const isAr = i18n.language?.startsWith('ar');
      const blTitre = isAr ? (job.titre_ar || job.titre) : (job.titre || job.titre_ar);
      document.title = `${blTitre} 2026 - طريقة التسجيل والوثائق المطلوبة | AtlasConcours`;
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = "description";
        document.head.appendChild(metaDesc);
      }
      metaDesc.content = `اكتشف تفاصيل وشروط التسجيل في مباراة ${blTitre} 2026. كل ما تحتاج معرفته من الوثائق المطلوبة وآخر أجل للتقديم على موقع AtlasConcours.`;
    }
  }, [job, i18n.language]);

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

  let extracted = {}, diplome, postes;
  try {
    extracted = extractJobData(bl.texte_complet || bl.description) || {};
    diplome = bl.diplome || extracted.formation;
    postes  = job.postes || extracted.postes;
  } catch (e) {
    console.error('JobDetailPage data extraction error:', e);
    extracted = {};
    diplome = '';
    postes = '';
  }

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
              {stripHtml(job.organisme || job.categorie || 'Secteur Public / Privé')}
            </span>
            {extracted.contrat && (
              <span className="badge badge-securite" style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
                <i className="fa fa-file-contract" style={{ marginRight: '6px' }}></i>
                {stripHtml(extracted.contrat)}
              </span>
            )}
          </div>

          <h1 style={{ fontSize: '36px', marginBottom: '24px', lineHeight: '1.2' }}>{stripHtml(bl.titre)}</h1>
          
          <div className="page-header-meta" style={{ gap: '24px' }}>
            {(job.entreprise || job.organisme) && (
              <div className="meta-item" style={{ fontSize: '16px' }}>
                <i className="fa fa-building"></i>
                <strong>{stripHtml(job.entreprise || job.organisme)}</strong>
              </div>
            )}
            {(job.localisation || job.ville) && (
              <div className="meta-item" style={{ fontSize: '16px' }}>
                <i className="fa fa-map-marker-alt"></i>
                {stripHtml(job.localisation || job.ville)}
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
                      <strong>{stripHtml(extracted.salaire)}</strong>
                    </div>
                  )}
                  {extracted.experience && (
                    <div>
                      <span style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Expérience</span>
                      <strong>{stripHtml(extracted.experience)}</strong>
                    </div>
                  )}
                  {extracted.formation && (
                    <div>
                      <span style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Formation requise</span>
                      <strong>{stripHtml(extracted.formation)}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

              <InfoCard 
                title="Description de l'annonce"
                fields={[
                  { icon: 'fa-calendar-alt', label: 'Date limite', value: formatDate(job.date_limite || job.deadline), urgent: true },
                  { icon: 'fa-building', label: 'Entreprise / Organisme', value: stripHtml(job.entreprise || job.organisme) },
                  { icon: 'fa-bullseye', label: 'Type de concours', value: stripHtml(extracted.typeRecrutement) },
                  { icon: 'fa-book', label: 'Spécialité', value: stripHtml(extracted.specialite) },
                  { icon: 'fa-file-contract', label: 'Type de contrat', value: stripHtml(extracted.contrat) },
                  { icon: 'fa-money-bill-wave', label: 'Salaire', value: stripHtml(extracted.salaire) },
                  { icon: 'fa-briefcase', label: 'Expérience professionnelle', value: stripHtml(extracted.experience) },
                  { icon: 'fa-users', label: 'Nombre de postes', value: stripHtml(postes) },
                  { icon: 'fa-graduation-cap', label: 'Formation / Diplôme', value: stripHtml(diplome) },
                  { icon: 'fa-map-marker-alt', label: 'Localisation', value: stripHtml(job.localisation || job.ville) }
                ]}
              />

              {(bl.texte_complet || bl.description) && (
                <div className="card" style={{ padding: '30px' }}>
                  <h3 style={{ color: 'var(--primary)', fontSize: '18px', marginBottom: '12px', fontWeight: 'bold' }}>Annonce</h3>
                  <div 
                    className="raw-annonce-content"
                    dangerouslySetInnerHTML={{ __html: bl.texte_complet || bl.description }}
                    ref={(el) => {
                      if (el) {
                        el.querySelectorAll('img').forEach(img => {
                          img.onerror = () => { img.style.display = 'none'; };
                        });
                      }
                    }}
                  />
                </div>
              )}

            {/* Meta chips — clean icon rows replacing the old table */}
            <div className="card concours-facts-card">
              <h2 className="card-section-title">
                <i className="fa fa-info-circle" style={{ color: 'var(--primary)', marginRight: 10 }}></i>
                Informations clés
              </h2>
              <div className="concours-meta-grid">
                {(job.entreprise || job.organisme) && (
                  <div className="meta-chip">
                    <span className="meta-chip-icon"><i className="fa fa-building"></i></span>
                    <div>
                      <span className="meta-chip-label">Entreprise / Administration</span>
                      <span className="meta-chip-value">{job.entreprise || job.organisme}</span>
                    </div>
                  </div>
                )}
                {extracted.contrat && (
                  <div className="meta-chip">
                    <span className="meta-chip-icon"><i className="fa fa-file-contract"></i></span>
                    <div>
                      <span className="meta-chip-label">Type de contrat</span>
                      <span className="meta-chip-value">{extracted.contrat}</span>
                    </div>
                  </div>
                )}
                {extracted.formation && (
                  <div className="meta-chip">
                    <span className="meta-chip-icon"><i className="fa fa-graduation-cap"></i></span>
                    <div>
                      <span className="meta-chip-label">Formation requise</span>
                      <span className="meta-chip-value">{extracted.formation}</span>
                    </div>
                  </div>
                )}
                <div className="meta-chip">
                  <span className="meta-chip-icon"><i className="fa fa-map-marker-alt"></i></span>
                  <div>
                    <span className="meta-chip-label">Localisation</span>
                    <span className="meta-chip-value">{job.localisation || job.ville || 'Maroc'}</span>
                  </div>
                </div>
                <div className="meta-chip meta-chip-urgent">
                  <span className="meta-chip-icon"><i className="fa fa-clock"></i></span>
                  <div>
                    <span className="meta-chip-label">Délai de dépôt</span>
                    <span className="meta-chip-value">{formatDate(job.date_limite || job.deadline)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CONTEXTUAL FAQ */}
            <InlineFAQ
              items={buildJobFAQ({
                titre: bl.titre,
                lien_candidature: job.lien_candidature,
                lien: job.lien,
                diplome: bl.diplome
              }, extracted)}
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
