import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import '../admin.css';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ concours: 0, emplois: 0, articles: 0, views: 0 });

  useEffect(() => {
    const token = localStorage.getItem('atlas_admin_token');
    if (!token) { navigate('/admin/login'); return; }
    api.get('/stats').then(res => {
      const t = res.data?.totaux || {};
      setStats({ concours: t.concours || 0, emplois: t.emplois || 0, articles: t.articles || 0, views: t.vues || 0 });
    }).catch(console.error);
  }, [navigate]);

  const logout = () => { localStorage.removeItem('atlas_admin_token'); navigate('/admin/login'); };

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Link to="/">
            <div className="s-icon">A</div>
            <span><span className="s-atlas">Atlas</span><span className="s-conc">Concours</span></span>
          </Link>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-label">Principal</div>
          <Link to="/admin/dashboard" className="active"><i className="fa fa-home"></i> Tableau de bord</Link>
          <Link to="/admin/concours"><i className="fa fa-clipboard-list"></i> Concours</Link>
          <Link to="/admin/emplois"><i className="fa fa-briefcase"></i> Emplois</Link>
          <div className="nav-section-label">Compte</div>
          <Link to="/"><i className="fa fa-home"></i> Voir le site</Link>
          <a href="#" onClick={e => { e.preventDefault(); logout(); }}><i className="fa fa-sign-out-alt"></i> Déconnexion</a>
        </nav>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <h2>Tableau de Bord</h2>
          <div className="header-right">
            <span className="admin-badge">Admin</span>
            <span>admin@atlasconcours.ma</span>
          </div>
        </header>

        <div className="admin-content">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon blue"><i className="fa fa-clipboard-list"></i></div>
              <div className="stat-body">
                <div className="num">{stats.concours}</div>
                <div className="lbl">Concours publiés</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green"><i className="fa fa-briefcase"></i></div>
              <div className="stat-body">
                <div className="num">{stats.emplois}</div>
                <div className="lbl">Offres d'emploi</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon amber"><i className="fa fa-newspaper"></i></div>
              <div className="stat-body">
                <div className="num">{stats.articles}</div>
                <div className="lbl">Articles</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon purple"><i className="fa fa-eye"></i></div>
              <div className="stat-body">
                <div className="num">{stats.views}</div>
                <div className="lbl">Vues totales</div>
              </div>
            </div>
          </div>

          <div className="chart-card">
            <h3>Activité Récente</h3>
            <div style={{height: '200px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)'}}>
              Graphique d'activité (en attente de données réelles)
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
