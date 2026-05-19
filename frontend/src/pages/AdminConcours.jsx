import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import '../admin.css';

const CATEGORIES = ['Sécurité', 'Éducation', 'Santé', 'Justice', 'Ingénierie', 'Administration', 'Général'];

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  return <div className={`toast ${type}`}>{msg}</div>;
}

function Sidebar({ active }) {
  const navigate = useNavigate();
  const logout = () => { localStorage.removeItem('atlas_admin_token'); navigate('/admin/login'); };
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Link to="/"><div className="s-icon">A</div><span><span className="s-atlas">Atlas</span><span className="s-conc">Concours</span></span></Link>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-section-label">Principal</div>
        <Link to="/admin/dashboard" className={active === 'dashboard' ? 'active' : ''}><i className="fa fa-home"></i> Tableau de bord</Link>
        <Link to="/admin/concours" className={active === 'concours' ? 'active' : ''}><i className="fa fa-clipboard-list"></i> Concours</Link>
        <Link to="/admin/emplois" className={active === 'emplois' ? 'active' : ''}><i className="fa fa-briefcase"></i> Emplois</Link>
        <div className="nav-section-label">Compte</div>
        <Link to="/"><i className="fa fa-home"></i> Voir le site</Link>
        <a href="#" onClick={e => { e.preventDefault(); logout(); }}><i className="fa fa-sign-out-alt"></i> Déconnexion</a>
      </nav>
    </aside>
  );
}

const EMPTY_FORM = { titre: '', description: '', categorie: 'Général', date_limite: '', lien_source: '' };

export default function AdminConcours() {
  const navigate = useNavigate();
  const [concours, setConcours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  useEffect(() => {
    const token = localStorage.getItem('atlas_admin_token');
    if (!token) { navigate('/admin/login'); return; }
    loadData();
  }, []);

  const loadData = () => {
    api.get('/concours?limit=200').then(res => {
      setConcours(Array.isArray(res.data?.data) ? res.data.data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const openCreate = () => { setForm(EMPTY_FORM); setEditId(null); setModal(true); };
  const openEdit = (c) => {
    setForm({ titre: c.titre || '', description: c.description || '', categorie: c.categorie || 'Général', date_limite: c.date_limite || '', lien_source: c.lien_source || '' });
    setEditId(c.id);
    setModal(true);
  };

  const handleDelete = async (id, titre) => {
    if (!window.confirm(`Supprimer "${titre}" ?`)) return;
    try {
      await api.delete('/concours/' + id);
      setConcours(prev => prev.filter(c => c.id !== id));
      showToast('Concours supprimé avec succès.');
    } catch (err) {
      showToast(err.response?.data?.error || 'Erreur lors de la suppression.', 'error');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.titre.trim()) { showToast('Le titre est requis.', 'error'); return; }
    setSaving(true);
    try {
      if (editId) {
        await api.put('/concours/' + editId, form);
        showToast('Concours mis à jour.');
      } else {
        await api.post('/concours', form);
        showToast('Concours créé avec succès.');
      }
      setModal(false);
      setLoading(true);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Erreur lors de la sauvegarde.', 'error');
    }
    setSaving(false);
  };

  const filtered = concours.filter(c =>
    !search || c.titre?.toLowerCase().includes(search.toLowerCase()) || c.categorie?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="admin-layout">
      <Sidebar active="concours" />
      <main className="admin-main">
        <header className="admin-header">
          <h2>Gestion des Concours</h2>
          <div className="header-right">
            <span className="admin-badge">Admin</span>
            <button className="btn-add" onClick={openCreate}><i className="fa fa-plus"></i> Nouveau Concours</button>
          </div>
        </header>

        <div className="admin-content">
          <div className="table-card">
            <div className="table-card-header">
              <h3>Liste des Concours ({filtered.length})</h3>
              <input className="table-search" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>Titre</th><th>Catégorie</th><th>Deadline</th><th>Vues</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan="6" style={{ textAlign: 'center', padding: 24 }}>Chargement...</td></tr>}
                {!loading && filtered.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>Aucun concours trouvé.</td></tr>}
                {!loading && filtered.map(c => (
                  <tr key={c.id}>
                    <td>#{c.id}</td>
                    <td style={{ fontWeight: 600, maxWidth: 280 }}>{c.titre}</td>
                    <td><span className="badge badge-blue">{c.categorie}</span></td>
                    <td>{c.date_limite || '—'}</td>
                    <td>{c.vues || 0}</td>
                    <td>
                      <div className="actions">
                        <button className="btn-icon btn-edit" title="Modifier" onClick={() => openEdit(c)}><i className="fa fa-edit"></i></button>
                        <button className="btn-icon btn-delete" title="Supprimer" onClick={() => handleDelete(c.id, c.titre)}><i className="fa fa-trash"></i></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal */}
      <div className={`modal-overlay ${modal ? 'open' : ''}`} onClick={e => e.target === e.currentTarget && setModal(false)}>
        <div className="modal">
          <div className="modal-header">
            <h3>{editId ? 'Modifier le Concours' : 'Nouveau Concours'}</h3>
            <button className="modal-close" onClick={() => setModal(false)}>×</button>
          </div>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label>Titre *</label>
              <input type="text" value={form.titre} onChange={e => setForm(p => ({ ...p, titre: e.target.value }))} placeholder="Titre du concours" required />
            </div>
            <div className="form-group">
              <label>Catégorie</label>
              <select value={form.categorie} onChange={e => setForm(p => ({ ...p, categorie: e.target.value }))}>
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Date Limite</label>
              <input type="date" value={form.date_limite} onChange={e => setForm(p => ({ ...p, date_limite: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Lien Source</label>
              <input type="url" value={form.lien_source} onChange={e => setForm(p => ({ ...p, lien_source: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea rows="6" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Description du concours..." />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-cancel" onClick={() => setModal(false)}>Annuler</button>
              <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
            </div>
          </form>
        </div>
      </div>

      {/* Toast */}
      <div className="toast-container">
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </div>
  );
}
