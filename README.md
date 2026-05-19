# AtlasConcours 🇲🇦

Plateforme marocaine de concours publics, offres d'emploi et blog carrière — 100% en français, optimisée SEO.

## 🚀 Installation Rapide

### Prérequis
- Node.js v18+ ([nodejs.org](https://nodejs.org))

### 1. Installer les dépendances
```bash
cd atlasconcours
npm install
```

### 2. Configurer l'environnement
```bash
copy .env.example .env
```

### 3. Lancer le serveur de développement
```bash
npm run dev
```

### 4. Charger les données de démonstration (première fois)
```bash
npm run seed
```

### 5. Ouvrir dans le navigateur
- **Site public** : http://localhost:3000
- **Admin** : http://localhost:3000/admin/login.html

---

## 🔐 Compte Admin Démo
| Champ | Valeur |
|-------|--------|
| Email | admin@atlasconcours.ma |
| Mot de passe | Admin2026! |

---

## 📁 Structure du Projet
```
atlasconcours/
├── server/
│   ├── index.js          # Serveur Express
│   ├── db.js             # Base de données SQLite
│   ├── seed.js           # Données de démonstration
│   ├── middleware/auth.js # JWT
│   └── routes/           # API REST
│       ├── auth.js
│       ├── concours.js
│       ├── emplois.js
│       ├── articles.js
│       └── stats.js
└── public/
    ├── index.html         # Accueil
    ├── concours.html      # Liste concours
    ├── concours-detail.html
    ├── emplois.html
    ├── blog.html
    ├── article-detail.html
    ├── css/
    │   ├── main.css
    │   └── admin.css
    ├── js/main.js
    └── admin/
        ├── login.html
        ├── dashboard.html
        ├── concours.html
        ├── emplois.html
        ├── blog.html
        └── admin.js
```

---

## 🌐 API Endpoints

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| POST | `/api/auth/login` | Connexion admin | — |
| GET | `/api/concours` | Liste concours (filtres: search, categorie, sort, page) | — |
| GET | `/api/concours/:slug` | Détail concours | — |
| POST | `/api/concours` | Créer concours | ✅ |
| PUT | `/api/concours/:id` | Modifier concours | ✅ |
| DELETE | `/api/concours/:id` | Supprimer concours | ✅ |
| GET | `/api/emplois` | Liste emplois | — |
| POST | `/api/emplois` | Créer offre | ✅ |
| PUT | `/api/emplois/:id` | Modifier offre | ✅ |
| DELETE | `/api/emplois/:id` | Supprimer offre | ✅ |
| GET | `/api/articles` | Liste articles | — |
| GET | `/api/articles/:slug` | Détail article | — |
| POST | `/api/articles` | Créer article | ✅ |
| PUT | `/api/articles/:id` | Modifier article | ✅ |
| DELETE | `/api/articles/:id` | Supprimer article | ✅ |
| GET | `/api/stats` | Statistiques dashboard | ✅ |
| GET | `/sitemap.xml` | Sitemap SEO | — |
| GET | `/robots.txt` | Robots | — |

---

## 🚀 Déploiement en Production

### Option 1 — VPS (DigitalOcean, Hetzner, OVH)
```bash
# Installer PM2
npm install -g pm2

# Démarrer en production
NODE_ENV=production pm2 start server/index.js --name atlasconcours
pm2 save
pm2 startup
```

### Option 2 — Railway / Render (gratuit)
1. Connecter le repo GitHub
2. Build command: `npm install`
3. Start command: `node server/index.js`
4. Variables d'env: `JWT_SECRET`, `PORT`

### Option 3 — Migration vers PostgreSQL
Remplacer `better-sqlite3` par `pg` et adapter `db.js`.

---

## 🔍 SEO
- URLs propres via slugs
- Meta title + description par page
- Open Graph tags (Facebook, Twitter)
- Sitemap.xml dynamique → `/sitemap.xml`
- Robots.txt → `/robots.txt`
- Compression gzip activée

---

## 📞 Support
**AtlasConcours** — atlasconcours.ma
