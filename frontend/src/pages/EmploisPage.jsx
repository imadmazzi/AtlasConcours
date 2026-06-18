import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api';

function formatDate(d) {
  if (!d) return 'N/A';
  const date = new Date(d);
  return isNaN(date) ? d : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function EmploisPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [emplois, setEmplois] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [city, setCity] = useState(searchParams.get('city') || '');
  const [type, setType] = useState(searchParams.get('type') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState('desc');
  const itemsPerPage = 10;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (city) params.set('city', city);
    if (type) params.set('type', type);
    if (category) params.set('category', category);
    params.set('limit', '500'); 
    
    api.get('/emplois?' + params.toString()).then(res => {
      setEmplois(Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []));
      setLoading(false);
      setCurrentPage(1);
    }).catch(() => setLoading(false));
  }, [search, city, type, category]); // Trigger fetch on filter change

  const handleSearch = (e) => {
    e.preventDefault();
    const currentParams = {};
    if (search) currentParams.search = search;
    if (city) currentParams.city = city;
    if (type) currentParams.type = type;
    if (category) currentParams.category = category;
    setSearchParams(currentParams);
  };

  const filteredAndSortedEmplois = useMemo(() => {
    let result = [...emplois];
    
    // Fallback local search just in case the backend limits didn't cover it
    if (search) {
      const term = search.toLowerCase();
      result = result.filter(e => 
        (e.titre && e.titre.toLowerCase().includes(term)) || 
        (e.entreprise && e.entreprise.toLowerCase().includes(term)) ||
        (e.organisme && e.organisme.toLowerCase().includes(term))
      );
    }
    if (city) {
      const term = city.toLowerCase();
      result = result.filter(e => e.localisation && e.localisation.toLowerCase().includes(term));
    }
    if (type) {
      const term = type.toLowerCase();
      result = result.filter(e => e.description && e.description.toLowerCase().includes(term));
    }
    if (category) {
      const term = category.toLowerCase();
      result = result.filter(e => 
        (e.entreprise && e.entreprise.toLowerCase().includes(term)) ||
        (e.description && e.description.toLowerCase().includes(term))
      );
    }

    result.sort((a, b) => {
      const dateA = new Date(a.created_at || a.date_limite || 0);
      const dateB = new Date(b.created_at || b.date_limite || 0);
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [emplois, sortOrder, search, city, type, category]);

  const totalPages = Math.ceil(filteredAndSortedEmplois.length / itemsPerPage) || 1;
  const currentItems = filteredAndSortedEmplois.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <main>
      <div className="page-hero">
        <div className="container">
          <h1>Offres d'<span style={{ color: 'var(--accent)' }}>Emploi</span></h1>
          <p>Toutes les offres d'emploi public au Maroc, mises à jour quotidiennement.</p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
        <div className="advanced-filters-container" style={{ marginBottom: '24px' }}>
          <form className="advanced-filters" onSubmit={handleSearch}>
            <div className="filter-group top-search">
              <input
                className="filter-input"
                type="text"
                placeholder="Rechercher une offre, un organisme..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn-primary">
                <i className="fa fa-search"></i> Rechercher
              </button>
            </div>
            
            <div className="filter-group selects-row">
              <select value={city} onChange={e => setCity(e.target.value)} className="filter-select">
                <option value="">Toutes les Villes</option>
                <option value="Casablanca">Casablanca</option>
                <option value="Rabat">Rabat</option>
                <option value="Tanger">Tanger</option>
                <option value="Marrakech">Marrakech</option>
                <option value="Fès">Fès</option>
                <option value="Remote">À distance (Remote)</option>
              </select>
              
              <select value={type} onChange={e => setType(e.target.value)} className="filter-select">
                <option value="">Type de Contrat</option>
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
                <option value="ANAPEC">ANAPEC</option>
                <option value="Freelance">Freelance</option>
                <option value="Public">Secteur Public</option>
              </select>
              
              <select value={category} onChange={e => setCategory(e.target.value)} className="filter-select">
                <option value="">Toutes les Catégories</option>
                <option value="IT">Informatique / IT</option>
                <option value="Finance">Finance / Compta</option>
                <option value="Santé">Santé / Médical</option>
                <option value="Administration">Administration</option>
                <option value="Ingénierie">Ingénierie</option>
              </select>
              
              <div className="sort-controls" style={{ display: 'flex', alignItems: 'center' }}>
                <select 
                  value={sortOrder} 
                  onChange={(e) => {
                    setSortOrder(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="filter-select sort-select"
                  style={{ fontWeight: 600, color: 'var(--primary)' }}
                >
                  <option value="desc">Plus récentes d'abord</option>
                  <option value="asc">Plus anciennes d'abord</option>
                </select>
              </div>
              
              <button 
                type="button" 
                className="btn-clear" 
                onClick={() => {
                  setCity('');
                  setType('');
                  setCategory('');
                  setSearch('');
                  setSearchParams({});
                }}
              >
                <i className="fa fa-times"></i>
              </button>
            </div>
          </form>
        </div>

        {!loading && (
          <p className="results-count"><strong>{filteredAndSortedEmplois.length}</strong> offres trouvées</p>
        )}

        {loading && <div className="loading"><div className="loading-spinner"></div><p>Chargement...</p></div>}
        
        {!loading && filteredAndSortedEmplois.length === 0 && (
          <div className="empty-state"><i className="fa fa-briefcase"></i><p>Aucune offre trouvée.</p></div>
        )}

        {!loading && filteredAndSortedEmplois.length > 0 && (
          <>
            <div className="job-table-container">
              <table className="job-table">
                <thead>
                  <tr>
                    <th>Logo</th>
                    <th>Titre de l'offre</th>
                    <th>Date de publication</th>
                    <th className="mobile-hide">Organisme / Entreprise</th>
                    <th className="mobile-hide">Lieu de travail</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map(e => (
                    <tr key={e.id} onClick={() => navigate(`/jobs/${e.id}`)}>
                      <td className="px-4 py-3 whitespace-nowrap w-12 text-center" data-label="Logo" style={{ width: 60 }}>
                        {e.imageUrl ? (
                          <img src={e.imageUrl} alt="logo" className="w-8 h-8 rounded-full object-contain mx-auto bg-slate-100" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'contain', margin: '0 auto', backgroundColor: '#f1f5f9' }} />
                        ) : (
                          <div className="w-10 h-10 rounded-md flex items-center justify-center mx-auto" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 8, margin: '0 auto', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                            <i className="fa fa-briefcase text-green-600 text-lg" style={{ fontSize: 18, color: '#16a34a' }}></i>
                          </div>
                        )}
                      </td>
                      <td data-label="Titre de l'offre">
                        <div className="job-title">{e.titre}</div>
                      </td>
                      <td data-label="Date de publication">
                        <div className="job-date">
                          <i className="fa fa-calendar" style={{marginRight: '6px', color: '#6c757d'}}></i>
                          {formatDate(e.created_at || e.date_limite || e.deadline)}
                        </div>
                      </td>
                      <td data-label="Organisme / Entreprise" className="mobile-hide">
                        <span className="badge badge-administration">{e.organisme || e.entreprise || e.categorie || 'Administration'}</span>
                      </td>
                      <td data-label="Lieu de travail" className="mobile-hide">
                        <div className="job-location">
                          <i className="fa fa-map-marker" style={{marginRight: '6px', color: '#6c757d'}}></i>
                          {e.localisation || 'Maroc'}
                        </div>
                      </td>
                      <td data-label="Action" className="action-cell">
                        <button 
                          className="btn-secondary btn-sm" 
                          onClick={(evt) => {
                            evt.stopPropagation();
                            navigate(`/jobs/${e.id}`);
                          }}
                        >
                          Voir détails
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button 
                  className="btn-secondary" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                >
                  &laquo; Précédent
                </button>
                <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontWeight: 'bold', fontSize: '14px' }}>
                  Page {currentPage} sur {totalPages}
                </span>
                <button 
                  className="btn-secondary" 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                >
                  Suivant &raquo;
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
