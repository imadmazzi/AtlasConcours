import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import InlineFAQ, { buildConcoursFAQ } from '../components/InlineFAQ';
import useBilingual from '../hooks/useBilingual';
import { useTranslation } from 'react-i18next';
import InfoCard from '../components/InfoCard';

const BADGE_MAP = {
  'Sécurité': 'securite', 'Éducation': 'education', 'Santé': 'sante',
  'Justice': 'justice', 'Ingénierie': 'ingenierie', 'Administration': 'administration'
};
function getBadge(cat) { return 'badge badge-' + (BADGE_MAP[cat] || 'general'); }

function formatDate(d) {
  if (!d || d === 'N/A') return 'Consulter l\'annonce';
  const date = new Date(d);
  return isNaN(date) ? String(d).trim() : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Regex-based metadata extractor from description plain text.
 */
function extractMeta(html) {
  if (!html) return {};
  const text = html.replace(/<[^>]*>/gm, ' ').replace(/\s+/g, ' ');

  const grab = (re) => {
    const m = text.match(re);
    return m ? m[1].trim() : null;
  };

  return {
    postes:          grab(/(?:Nombre\s+de\s+postes?|Postes?\s+ouverts?)[\s:–\-]*(\d{1,4})/i) || grab(/(\d{1,4})\s+postes?/i),
    grade:           grab(/(?:Grade|Corps)[\s:–\-]*([A-Za-zÀ-ÿ0-9 \-éèêëàâùûü']{3,80}?)(?:\s*[\n|]|(?=\s{2,}))/i),
    echelle:         grab(/(?:Échelle|Echelon)[\s:–\-]*([A-Za-zÀ-ÿ0-9 \-éèêëàâùûü']{1,40}?)(?:\s*[\n|]|(?=\s{2,}))/i),
    ministere:       grab(/(?:Minist[eè]re|Organisme|Administration|Établissement)[\s:–\-]*([^|<\n]{4,80}?)(?:\s*[\n|]|(?=\s{2,}))/i),
    diplome:         grab(/(?:Dipl[oô]me|Formation|Niveau\s+requis)[\s:–\-]*([^|<\n]{4,80}?)(?:\s*[\n|]|(?=\s{2,}))/i),
    datePubli:       grab(/(?:Date\s+de\s+publication|Publié\s+le|Publication)[\s:–\-]*([0-9\/\-][\w \/\-éûùàâ]{4,30})/i),
    typeRecrutement: grab(/(?:Type\s+de\s+recrutement|Type\s+de\s+concours|Recrutement)[\s:–\-]*([A-Za-zÀ-ÿ0-9 \-éèêëàâùûü']{3,60}?)(?:\s*[\n|]|(?=\s{2,}))/i),
    specialite:      grab(/(?:Spécialité|Option|Filière|Domaine)[\s:–\-]*([^|<\n]{3,60}?)(?:\s*[\n|]|(?=\s{2,}))/i),
  };
}

const stripHtml = (html) => html ? String(html).replace(/<[^>]*>?/gm, '').trim() : '';

export default function ConcoursDetailPage() {
  const { id } = useParams();
  const [concours, setConcours] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { i18n } = useTranslation();

  const bl = useBilingual(concours);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    if (concours) {
      const isAr = i18n.language?.startsWith('ar');
      const blTitre = isAr ? (concours.titre_ar || concours.titre) : (concours.titre || concours.titre_ar);
      document.title = `${blTitre} 2026 - طريقة التسجيل والوثائق المطلوبة | AtlasConcours`;
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = "description";
        document.head.appendChild(metaDesc);
      }
      metaDesc.content = `اكتشف تفاصيل وشروط التسجيل في مباراة ${blTitre} 2026. كل ما تحتاج معرفته من الوثائق المطلوبة وآخر أجل للتقديم على موقع AtlasConcours.`;
    }
  }, [concours, i18n.language]);

  useEffect(() => {
    setLoading(true);
    setError(false);
    api.get('/concours/' + id).then(res => {
      setConcours(res.data);
      setLoading(false);
    }).catch(() => { setError(true); setLoading(false); });
  }, [id]);

  if (loading) return (
    <div className="loading" style={{ paddingTop: 80 }}>
      <div className="loading-spinner"></div>
      <p>Chargement du concours...</p>
    </div>
  );
  if (error || !concours) return (
    <div className="empty-state" style={{ paddingTop: 80 }}>
      <i className="fa fa-exclamation-triangle"></i>
      <p>Concours introuvable.</p>
      <Link to="/concours" className="btn-primary" style={{ marginTop: 20 }}>← Retour aux concours</Link>
    </div>
  );

  let meta = {}, organisme, postes, grade, echelle, diplome, datePubli, typeRecrutement, specialite;
  try {
    meta = extractMeta(bl.texte_complet || bl.description) || {};
    organisme = concours.organisme || meta.ministere;
    postes    = concours.postes || meta.postes;
    grade     = meta.grade;
    echelle   = meta.echelle;
    diplome   = bl.diplome || meta.diplome;
    datePubli = meta.datePubli;
    typeRecrutement = meta.typeRecrutement;
    specialite = meta.specialite;
  } catch (e) {
    console.error('ConcoursDetailPage data extraction error:', e);
    organisme = concours.organisme || '';
    postes = concours.postes || '';
    grade = '';
    echelle = '';
    diplome = '';
    datePubli = '';
    typeRecrutement = '';
    specialite = '';
  }

  return (
    <main className="page-job-detail">

      <div className="page-header concours-hero">
        <div className="container">

          <nav className="breadcrumb" aria-label="Fil d'Ariane" style={{ marginBottom: '28px' }}>
            <Link to="/">Accueil</Link>
            <span className="sep">›</span>
            <Link to="/concours">Concours</Link>
            <span className="sep">›</span>
            <span className="current">Détails du concours</span>
          </nav>

          <div className="concours-badges" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <span className="chip chip-glass">
              <i className="fa fa-hashtag"></i>
              Réf : {String(concours.id || '').substring(0, 8).toUpperCase() || 'N/A'}
            </span>
            <span className="chip chip-accent">
              <i className="fa fa-graduation-cap"></i>
              {stripHtml(concours.categorie) || 'Concours Public'}
            </span>
          </div>

          <h1 className="concours-hero-title">{stripHtml(bl.titre)}</h1>

          <div className="concours-meta-grid">
            {organisme && (
              <div className="meta-chip">
                <span className="meta-chip-icon"><i className="fa fa-landmark"></i></span>
                <div>
                  <span className="meta-chip-label">Organisme</span>
                  <span className="meta-chip-value">{stripHtml(organisme)}</span>
                </div>
              </div>
            )}
            {grade && (
              <div className="meta-chip">
                <span className="meta-chip-icon"><i className="fa fa-layer-group"></i></span>
                <div>
                  <span className="meta-chip-label">Grade / Échelle</span>
                  <span className="meta-chip-value">{stripHtml(grade)}</span>
                </div>
              </div>
            )}
            {postes && (
              <div className="meta-chip">
                <span className="meta-chip-icon"><i className="fa fa-users"></i></span>
                <div>
                  <span className="meta-chip-label">Postes ouverts</span>
                  <span className="meta-chip-value value-badge">{stripHtml(postes)}</span>
                </div>
              </div>
            )}
            {diplome && (
              <div className="meta-chip">
                <span className="meta-chip-icon"><i className="fa fa-graduation-cap"></i></span>
                <div>
                  <span className="meta-chip-label">Diplôme requis</span>
                  <span className="meta-chip-value">{stripHtml(diplome)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container" style={{ padding: '40px 24px 80px' }}>
        <div className="detail-layout">

          <div className="detail-main" style={{ display: 'flex', flexDirection: 'column', gap: '28px', padding: 0, border: 'none', background: 'transparent' }}>

              <InfoCard 
                title="Détails du concours"
                fields={[
                  { icon: 'fa-heading', label: 'Titre', value: bl.titre },
                  { icon: 'fa-building', label: 'Organisme', value: stripHtml(organisme) },
                  { icon: 'fa-user-tie', label: 'Grade', value: stripHtml(grade) },
                  { icon: 'fa-bullseye', label: 'Type', value: stripHtml(typeRecrutement) },
                  { icon: 'fa-book', label: 'Spécialité', value: stripHtml(specialite) },
                  { icon: 'fa-users', label: 'Nombre de postes', value: stripHtml(postes) },
                  { icon: 'fa-calendar-alt', label: 'Date limite', value: formatDate(concours.date_limite), urgent: true }
                ]}
              />

            {/* CONTEXTUAL FAQ */}
            <InlineFAQ
              items={buildConcoursFAQ({
                titre: bl.titre,
                lien_source: concours.lien_source,
                diplome: bl.diplome
              }, { postes, grade, diplome })}
              title="أسئلة شائعة حول هذه المباراة"
            />

            {/* TAGS & KEYWORDS (SEO) */}
            <div className="card" style={{ marginTop: '30px', padding: '24px' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '16px', color: 'var(--text-muted)' }}>
                <i className="fa fa-tags" style={{ marginRight: '8px' }}></i>
                Mots-clés / الكلمات المفتاحية
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <Link to="/concours" className="badge" style={{ background: '#f1f5f9', color: 'var(--text)', border: '1px solid #e2e8f0', textDecoration: 'none' }}>مباريات المغرب 2026</Link>
                <Link to="/concours" className="badge" style={{ background: '#f1f5f9', color: 'var(--text)', border: '1px solid #e2e8f0', textDecoration: 'none' }}>التوظيف بالمغرب</Link>
                <Link to="/concours" className="badge" style={{ background: '#f1f5f9', color: 'var(--text)', border: '1px solid #e2e8f0', textDecoration: 'none' }}>وظيفة عمومية</Link>
                {concours.categorie && (
                  <Link to="/concours" className="badge" style={{ background: '#f1f5f9', color: 'var(--text)', border: '1px solid #e2e8f0', textDecoration: 'none' }}>مباراة {concours.categorie}</Link>
                )}
                {organisme && (
                  <Link to="/concours" className="badge" style={{ background: '#f1f5f9', color: 'var(--text)', border: '1px solid #e2e8f0', textDecoration: 'none' }}>{organisme}</Link>
                )}
              </div>
            </div>
          </div>

          {/* SIDEBAR */}
          <aside className="detail-sidebar">
            <div className="card cta-card-sticky">
              <div className="cta-icon-header">
                <i className="fa fa-graduation-cap"></i>
              </div>
              <h3 className="cta-title">Postulez à ce concours</h3>
              <p className="cta-subtitle">
                Consultez le dossier officiel et déposez votre candidature avant le
                <strong> {formatDate(concours.date_limite)}</strong>.
              </p>

              {concours.lien_source ? (
                <a
                  href={concours.lien_source}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary cta-btn-main"
                  id="concours-apply-btn"
                >
                  <i className="fa fa-external-link-alt"></i>
                  Voir l'offre officielle
                </a>
              ) : (
                <div className="cta-link-unavailable">
                  <i className="fa fa-exclamation-circle"></i>
                  Lien officiel indisponible
                </div>
              )}

              <Link to="/concours" className="btn-outline cta-btn-back">
                ← Retour aux concours
              </Link>
            </div>

            {/* Quick deadline reminder card */}
            <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>📅</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Date limite</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--danger)' }}>{formatDate(concours.date_limite)}</div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
