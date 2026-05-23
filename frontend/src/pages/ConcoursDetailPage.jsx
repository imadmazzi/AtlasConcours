import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import DOMPurify from 'dompurify';
import api from '../api';

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
 * Smart HTML extractor — finds the main content section of emploi-public pages,
 * strips nav/header/footer noise, and returns sanitized renderable HTML.
 */
function extractCleanDescription(raw) {
  if (!raw) return '<p>Aucune description disponible.</p>';

  // If it's a full HTML page, parse and extract only the body content
  const isFullPage = /<!DOCTYPE|<html/i.test(raw);

  let content = raw;

  if (isFullPage) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(raw, 'text/html');

      // Try specific emploi-public content selectors first
      const selectors = [
        '.offres-details',
        '.detail-offre',
        '.job-detail',
        '.offre-detail',
        '.annonce-detail',
        'article.detail',
        '.content-detail',
        '.main-content',
        '[class*="detail"]',
        'main',
        '#main-content',
      ];

      let extracted = null;
      for (const sel of selectors) {
        const el = doc.querySelector(sel);
        if (el && el.textContent.trim().length > 100) {
          extracted = el;
          break;
        }
      }

      if (extracted) {
        // Remove sub-navigation noise inside the extracted section
        ['nav', 'header', 'footer', '.navbar', '.breadcrumb', '.pagination',
         '.loader-d', '#accessPanel', '.rs_addtools', 'script', 'style', 'iframe'
        ].forEach(s => extracted.querySelectorAll(s).forEach(n => n.remove()));
        content = extracted.innerHTML;
      } else {
        // Fallback: use body but strip all obvious nav/chrome
        ['nav', 'header', 'footer', '.navbar', '.sidebar', '.loader-d',
         '#accessPanel', 'script', 'style', 'iframe', '.breadcrumb'
        ].forEach(s => doc.querySelectorAll(s).forEach(n => n.remove()));
        content = doc.body?.innerHTML || raw;
      }
    } catch (e) {
      // DOMParser unavailable (SSR) — fall through to raw sanitization
    }
  }

  // Sanitize but keep all structural tags needed for tables
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [
      'h1','h2','h3','h4','h5','h6',
      'p','br','hr',
      'ul','ol','li',
      'strong','b','em','i','u','mark','span',
      'table','thead','tbody','tfoot','tr','th','td','caption','colgroup','col',
      'div','section','article',
      'img','figure','figcaption',
      'a','blockquote','pre','code',
    ],
    ALLOWED_ATTR: ['href','target','rel','src','alt','width','height','class','style','colspan','rowspan','scope'],
    ALLOW_DATA_ATTR: false,
  });
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
    postes:     grab(/(?:Nombre\s+de\s+postes?|Postes?\s+ouverts?)[\s:–\-]*(\d{1,4})/i),
    grade:      grab(/(?:Grade|Échelle|Echelon|Corps)[\s:–\-]*([A-Za-zÀ-ÿ0-9 \-éèêëàâùûü']{3,60}?)(?:\s*[\n|]|(?=\s{2,}))/i),
    ministere:  grab(/(?:Minist[eè]re|Organisme|Administration|Établissement)[\s:–\-]*([^|<\n]{4,80}?)(?:\s*[\n|]|(?=\s{2,}))/i),
    diplome:    grab(/(?:Dipl[oô]me|Formation|Niveau\s+requis)[\s:–\-]*([^|<\n]{4,80}?)(?:\s*[\n|]|(?=\s{2,}))/i),
    datePubli:  grab(/(?:Date\s+de\s+publication|Publié\s+le|Publication)[\s:–\-]*([0-9\/\-][\w \/\-éûùàâ]{4,30})/i),
  };
}

export default function ConcoursDetailPage() {
  const { id } = useParams();
  const [concours, setConcours] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    api.get('/concours/' + id).then(res => {
      setConcours(res.data);
      setLoading(false);
    }).catch(() => { setError(true); setLoading(false); });
  }, [id]);

  // After content renders, wrap all bare tables in a scroll container
  useEffect(() => {
    if (!contentRef.current) return;
    contentRef.current.querySelectorAll('table').forEach(table => {
      if (table.parentElement.classList.contains('table-scroll')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'table-scroll';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
    // Make all links in description open in new tab safely
    contentRef.current.querySelectorAll('a').forEach(a => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noreferrer noopener');
    });
  }, [concours]);

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

  const cleanContent = extractCleanDescription(concours.description);
  const meta = extractMeta(concours.description);

  // Merge API fields with regex-extracted fallbacks
  const organisme = concours.organisme || meta.ministere;
  const postes    = meta.postes;
  const grade     = meta.grade;
  const diplome   = meta.diplome;
  const datePubli = meta.datePubli;

  return (
    <main className="page-job-detail">

      {/* ── HERO HEADER ─────────────────────────────────────────────── */}
      <div className="page-header concours-hero">
        <div className="container">

          {/* Breadcrumb */}
          <nav className="breadcrumb" aria-label="Fil d'Ariane" style={{ marginBottom: '28px' }}>
            <Link to="/">Accueil</Link>
            <span className="sep">›</span>
            <Link to="/concours">Concours</Link>
            <span className="sep">›</span>
            <span className="current">Détails du concours</span>
          </nav>

          {/* Type badges row */}
          <div className="concours-badges" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <span className="chip chip-glass">
              <i className="fa fa-hashtag"></i>
              Réf : {String(concours.id || '').substring(0, 8).toUpperCase() || 'N/A'}
            </span>
            <span className="chip chip-accent">
              <i className="fa fa-graduation-cap"></i>
              {concours.categorie || 'Concours Public'}
            </span>
          </div>

          {/* Title */}
          <h1 className="concours-hero-title">{concours.titre}</h1>

          {/* Meta chips grid */}
          <div className="concours-meta-grid">
            {organisme && (
              <div className="meta-chip">
                <span className="meta-chip-icon"><i className="fa fa-landmark"></i></span>
                <div>
                  <span className="meta-chip-label">Organisme</span>
                  <span className="meta-chip-value">{organisme}</span>
                </div>
              </div>
            )}
            {postes && (
              <div className="meta-chip">
                <span className="meta-chip-icon"><i className="fa fa-users"></i></span>
                <div>
                  <span className="meta-chip-label">Postes ouverts</span>
                  <span className="meta-chip-value" style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '20px' }}>{postes}</span>
                </div>
              </div>
            )}
            {datePubli && (
              <div className="meta-chip">
                <span className="meta-chip-icon"><i className="fa fa-calendar-plus"></i></span>
                <div>
                  <span className="meta-chip-label">Date de publication</span>
                  <span className="meta-chip-value">{datePubli}</span>
                </div>
              </div>
            )}
            <div className="meta-chip meta-chip-urgent">
              <span className="meta-chip-icon"><i className="fa fa-clock"></i></span>
              <div>
                <span className="meta-chip-label">Date limite</span>
                <span className="meta-chip-value">{formatDate(concours.date_limite)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BODY LAYOUT ─────────────────────────────────────────────── */}
      <div className="container" style={{ padding: '40px 24px 80px' }}>
        <div className="detail-layout">

          {/* MAIN CONTENT */}
          <div className="detail-main" style={{ display: 'flex', flexDirection: 'column', gap: '28px', padding: 0, border: 'none', background: 'transparent' }}>

            {/* Quick Facts card — only if we have extracted data */}
            {(postes || grade || diplome) && (
              <div className="card concours-facts-card">
                <h2 className="card-section-title">
                  <i className="fa fa-info-circle" style={{ color: 'var(--primary)', marginRight: 10 }}></i>
                  Résumé du concours
                </h2>
                <div className="facts-grid">
                  {postes && (
                    <div className="fact-item">
                      <span className="fact-label">Postes ouverts</span>
                      <span className="fact-value highlight">{postes}</span>
                    </div>
                  )}
                  {grade && (
                    <div className="fact-item">
                      <span className="fact-label">Grade / Échelle</span>
                      <span className="fact-value">{grade}</span>
                    </div>
                  )}
                  {diplome && (
                    <div className="fact-item">
                      <span className="fact-label">Diplôme requis</span>
                      <span className="fact-value">{diplome}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Main description card */}
            <div className="card concours-desc-card">
              <h2 className="card-section-title" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 28 }}>
                <i className="fa fa-file-alt" style={{ color: 'var(--primary)', marginRight: 10 }}></i>
                Avis de concours officiel
              </h2>

              <div
                ref={contentRef}
                className="detail-content concours-prose"
                dangerouslySetInnerHTML={{ __html: cleanContent }}
              />
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
