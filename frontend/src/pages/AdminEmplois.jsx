import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import '../admin.css';

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

const EMPTY_FORM = { titre: '', description: '', organisme: '', ville: '', date_limite: '', lien: '' };

export default function AdminEmplois() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
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
    api.get('/emplois?limit=200').then(res => {
      setJobs(Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []));
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const openCreate = () => { setForm(EMPTY_FORM); setEditId(null); setModal(true); };
  const openEdit = (j) => {
    setForm({ titre: j.titre || '', description: j.description || '', organisme: j.organisme || j.entreprise || '', ville: j.ville || j.localisation || '', date_limite: j.date_limite || j.deadline || '', lien: j.lien || '' });
    setEditId(j.id);
    setModal(true);
  };

  const handleDelete = async (id, titre) => {
    if (!window.confirm(`Supprimer l'offre "${titre}" ?`)) return;
    try {
      await api.delete('/emplois/' + id);
      setJobs(prev => prev.filter(j => j.id !== id));
      showToast('Offre supprimée avec succès.');
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
        await api.put('/emplois/' + editId, form);
        showToast('Offre mise à jour.');
      } else {
        await api.post('/emplois', form);
        showToast('Offre créée avec succès.');
      }
      setModal(false);
      setLoading(true);
      loadData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Erreur lors de la sauvegarde.', 'error');
    }
    setSaving(false);
  };

  const filtered = jobs.filter(j =>
    !search || j.titre?.toLowerCase().includes(search.toLowerCase()) || (j.organisme || j.entreprise || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="admin-layout">
      <Sidebar active="emplois" />
      <main className="admin-main">
        <header className="admin-header">
          <h2>Gestion des Emplois</h2>
          <div className="header-right">
            <span className="admin-badge">Admin</span>
            <button className="btn-add green" onClick={openCreate}><i className="fa fa-plus"></i> Nouvelle Offre</button>
          </div>
        </header>

        <div className="admin-content">
          <div className="table-card">
            <div className="table-card-header">
              <h3>Offres d'Emploi ({filtered.length})</h3>
              <input className="table-search" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>Titre</th><th>Organisme</th><th>Ville</th><th>Deadline</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan="6" style={{ textAlign: 'center', padding: 24 }}>Chargement...</td></tr>}
                {!loading && filtered.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>Aucune offre trouvée.</td></tr>}
                {!loading && filtered.map(j => (
                  <tr key={j.id}>
                    <td>#{j.id}</td>
                    <td style={{ fontWeight: 600, maxWidth: 280 }}>{j.titre}</td>
                    <td>{j.organisme || j.entreprise || '—'}</td>
                    <td><span className="badge badge-green">{j.ville || j.localisation || '—'}</span></td>
                    <td>{j.date_limite || j.deadline || '—'}</td>
                    <td>
                      <div className="actions">
                        <button className="btn-icon btn-edit" title="Modifier" onClick={() => openEdit(j)}><i className="fa fa-edit"></i></button>
                        <button className="btn-icon btn-delete" title="Supprimer" onClick={() => handleDelete(j.id, j.titre)}><i className="fa fa-trash"></i></button>
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
            <h3>{editId ? "Modifier l'Offre" : "Nouvelle Offre d'Emploi"}</h3>
            <button className="modal-close" onClick={() => setModal(false)}>×</button>
          </div>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label>Titre *</label>
              <input type="text" value={form.titre} onChange={e => setForm(p => ({ ...p, titre: e.target.value }))} placeholder="Titre du poste" required />
            </div>
            <div className="form-group">
              <label>Organisme / Entreprise</label>
              <input type="text" value={form.organisme} onChange={e => setForm(p => ({ ...p, organisme: e.target.value }))} placeholder="Nom de l'organisme" />
            </div>
            <div className="form-group">
              <label>Ville</label>
              <input type="text" value={form.ville} onChange={e => setForm(p => ({ ...p, ville: e.target.value }))} placeholder="Casablanca, Rabat..." />
            </div>
            <div className="form-group">
              <label>Date Limite</label>
              <input type="date" value={form.date_limite} onChange={e => setForm(p => ({ ...p, date_limite: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Lien de candidature</label>
              <input type="url" value={form.lien} onChange={e => setForm(p => ({ ...p, lien: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea rows="6" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Description du poste..." />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-cancel" onClick={() => setModal(false)}>Annuler</button>
              <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
            </div>
          </form>
        </div>
      </div>

      <div className="toast-container">
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </div>
  );
}
