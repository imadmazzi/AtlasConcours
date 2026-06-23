import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api';

export default function Hero() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/stats').then(res => setStats(res.data)).catch(() => {});
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category) params.set('categorie', category);
    navigate('/concours?' + params.toString());
  };

  return (
    <section className="hero">
      <div style={{ position: 'relative', zIndex: 1 }}>
      <div className="hero-badge">
        <i className="fa fa-star"></i>
        {t('hero.badge') ? t('hero.badge') : 'N°1 des Concours Publics au Maroc'}
      </div>
      <h1>
        {t('hero.title_start') ? t('hero.title_start') : 'Trouvez les derniers'}
        <span className="accent">{t('hero.title_accent') ? t('hero.title_accent') : ' Concours au Maroc'}</span>
      </h1>
      <p>{t('hero.desc') ? t('hero.desc') : 'Tous les concours publics, offres d\'emploi et conseils carrière en un seul endroit.'}</p>

      <form className="hero-search" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder={t('search.placeholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">{t('search.all_categories') ? t('search.all_categories') : 'Toutes catégories'}</option>
          <option value="Sécurité">{t('categories.securite') ? t('categories.securite') : 'Sécurité'}</option>
          <option value="Éducation">{t('categories.education') ? t('categories.education') : 'Éducation'}</option>
          <option value="Santé">{t('categories.sante') ? t('categories.sante') : 'Santé'}</option>
          <option value="Justice">{t('categories.justice') ? t('categories.justice') : 'Justice'}</option>
          <option value="Ingénierie">{t('categories.ingenierie') ? t('categories.ingenierie') : 'Ingénierie'}</option>
          <option value="Administration">{t('categories.administration') ? t('categories.administration') : 'Administration'}</option>
        </select>
        <button type="submit">
          <i className="fa fa-search"></i> {t('search.button')}
        </button>
      </form>

      <div className="hero-ctas">
        <Link to="/concours" className="hero-cta btn-primary">
          <i className="fa fa-building"></i> Concours Publics
        </Link>
        <Link to="/jobs" className="hero-cta btn-outline-white">
          <i className="fa fa-briefcase"></i> Offres d'Emploi
        </Link>
      </div>

      <div className="hero-stats">
        <div className="stat-item">
          <span className="stat-num">{stats?.totaux?.concours ?? 0}</span>
          <span className="stat-label">Concours actifs</span>
        </div>
        <div className="stat-item">
          <span className="stat-num">{stats?.totaux?.emplois ?? 0}</span>
          <span className="stat-label">Offres d'emploi</span>
        </div>
        <div className="stat-item">
          <span className="stat-num">{stats?.totaux?.articles ?? 0}</span>
          <span className="stat-label">Articles</span>
        </div>
        <div className="stat-item">
          <span className="stat-num">+100K</span>
          <span className="stat-label">Visiteurs</span>
        </div>
      </div>
      </div>
    </section>
  );
}
