import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import '../admin.css';

export default function AdminLogin() {
  const [email, setEmail] = useState('admin@atlasconcours.ma');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.token) {
        localStorage.setItem('atlas_admin_token', res.data.token);
        navigate('/admin/dashboard');
      } else {
        setError('Identifiants incorrects.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur de connexion.');
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">
          <div className="logo-icon">A</div>
          <h1><span className="atlas">Atlas</span><span className="conc">Concours</span></h1>
          <p>Tableau de bord administrateur</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label><i className="fa fa-envelope"></i> Adresse Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label><i className="fa fa-lock"></i> Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>
          {error && <div className="login-error" style={{ display: 'block' }}>{error}</div>}
          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'Connexion...' : '→ Se connecter'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.85rem', color: '#64748b' }}>
          Demo: admin@atlasconcours.ma / Admin2026!
        </p>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Link to="/" style={{ color: '#1a56db', fontSize: '0.875rem' }}>← Retour au site</Link>
        </div>
      </div>
    </div>
  );
}
