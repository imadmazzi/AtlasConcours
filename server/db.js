const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Support Render Persistent Disk via DATA_DIR env var, fallback to project root
const dbPath = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'db.json')
  : path.join(__dirname, '../db.json');


const defaultData = {
  users: [],
  concours: [
    { id: 1, titre: "Concours Police 2026", slug: "concours-police-2026", description: "Recrutement de 2000 agents de police.", categorie: "Sécurité", date_limite: "2026-06-30", lien_source: "https://police.ma", vues: 150, created_at: new Date().toISOString() },
    { id: 2, titre: "Concours Ministère de l'Éducation", slug: "concours-education-2026", description: "Recrutement d'enseignants.", categorie: "Éducation", date_limite: "2026-07-15", lien_source: "https://men.gov.ma", vues: 300, created_at: new Date().toISOString() }
  ],
  emplois: [
    { id: 1, titre: "Développeur Full Stack", entreprise: "TechCorp", localisation: "Casablanca", description: "Recherche dev full stack JS.", lien_candidature: "https://techcorp.ma", created_at: new Date().toISOString() }
  ],
  articles: [
    { id: 1, titre: "Comment rédiger un bon CV", slug: "comment-rediger-bon-cv", contenu: "Voici nos astuces pour un CV parfait.", tags: "CV, Emploi", vues: 50, created_at: new Date().toISOString() }
  ]
};

const db = {
  data: defaultData,
  
  init: async function() {
    if (process.env.MONGODB_URI) {
      console.log('🔌 Connecting to MongoDB Atlas...');
      try {
        const { MongoClient } = require('mongodb');
        this.client = new MongoClient(process.env.MONGODB_URI);
        await this.client.connect();
        this.db = this.client.db();
        this.collection = this.db.collection('store');
        const doc = await this.collection.findOne({ _id: 'main_db' });
        if (doc && doc.data) {
          this.data = doc.data;
          console.log('✅ Loaded data from MongoDB Atlas!');
        } else {
          // Initialize with default admin user
          const hashedPassword = bcrypt.hashSync('Admin2026!', 10);
          const initData = JSON.parse(JSON.stringify(defaultData));
          initData.users.push({
            id: 1,
            nom: 'Administrateur',
            email: 'admin@atlasconcours.ma',
            password: hashedPassword,
            role: 'admin',
            created_at: new Date().toISOString()
          });
          await this.collection.insertOne({ _id: 'main_db', data: initData });
          this.data = initData;
          console.log('✅ Initialized MongoDB Atlas with default data!');
        }
      } catch (err) {
        console.error('❌ MongoDB Atlas connection error, falling back to local files:', err.message);
        this.loadLocal();
      }
    } else {
      this.loadLocal();
    }
  },

  loadLocal: function() {
    if (!fs.existsSync(dbPath)) {
      const hashedPassword = bcrypt.hashSync('Admin2026!', 10);
      const initData = JSON.parse(JSON.stringify(defaultData));
      initData.users.push({
        id: 1,
        nom: 'Administrateur',
        email: 'admin@atlasconcours.ma',
        password: hashedPassword,
        role: 'admin',
        created_at: new Date().toISOString()
      });
      fs.writeFileSync(dbPath, JSON.stringify(initData, null, 2));
      console.log('✅ DB JSON initialisée avec admin@atlasconcours.ma / Admin2026!');
    }
    this.data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    console.log('✅ Loaded data from local db.json!');
  },

  save: function() {
    if (process.env.MONGODB_URI && this.collection) {
      this.collection.updateOne({ _id: 'main_db' }, { $set: { data: this.data } })
        .then(() => console.log('💾 Saved to MongoDB Atlas!'))
        .catch(err => console.error('❌ Error saving to MongoDB Atlas:', err.message));
    } else {
      fs.writeFileSync(dbPath, JSON.stringify(this.data, null, 2));
      console.log('💾 Saved to local db.json!');
    }
  },

  
  prepare: function(query) {
    console.log('SQL:', query);
    return {
      all: (...args) => {
        console.log('ARGS:', args);
        if (query.includes('FROM concours')) {
          let list = [...this.data.concours];
          // args contain params, limit, offset. If there are > 2 args, it means filters are applied.
          if (args.length > 2) {
            const searchParam = args.find(a => typeof a === 'string' && a.startsWith('%'));
            if (searchParam) {
              const term = searchParam.replace(/%/g, '').toLowerCase();
              list = list.filter(c => c.titre.toLowerCase().includes(term) || c.description.toLowerCase().includes(term) || c.categorie.toLowerCase().includes(term));
            }
          }
          const limit = args[args.length - 2];
          const offset = args[args.length - 1];
          return list.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(offset, offset + limit);
        }
        if (query.includes('FROM emplois')) {
          let list = [...this.data.emplois];
          const stringParams = args.filter(a => typeof a === 'string' && a.startsWith('%'));
          for (const param of stringParams) {
             const term = param.replace(/%/g, '').toLowerCase();
             list = list.filter(e => 
               (e.titre && e.titre.toLowerCase().includes(term)) || 
               (e.entreprise && e.entreprise.toLowerCase().includes(term)) || 
               (e.localisation && e.localisation.toLowerCase().includes(term)) ||
               (e.description && e.description.toLowerCase().includes(term))
             );
          }
          if (query.includes('LIMIT ? OFFSET ?')) {
            const limit = typeof args[args.length - 2] === 'number' ? args[args.length - 2] : 12;
            const offset = typeof args[args.length - 1] === 'number' ? args[args.length - 1] : 0;
            return list.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(offset, offset + limit);
          }
          return list.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        }
      },
      get: (...args) => {
        console.log('ARGS (get):', args);
        if (query.includes('SELECT id FROM users WHERE email')) return this.data.users.find(u => u.email === args[0]);
        if (query.includes('SELECT * FROM users WHERE email')) return this.data.users.find(u => u.email === args[0]);
        if (query.includes('FROM concours WHERE id')) return this.data.concours.find(c => c.id == args[0]);
        if (query.includes('FROM concours WHERE slug')) return this.data.concours.find(c => c.slug === args[0]);
        if (query.includes('FROM emplois WHERE id')) return this.data.emplois.find(e => e.id == args[0]);
        if (query.includes('FROM articles WHERE slug')) return this.data.articles.find(a => a.slug === args[0]);
        if (query.includes('FROM articles WHERE id')) return this.data.articles.find(a => a.id == args[0]);
        
        if (query.includes('COUNT(*) as total FROM concours')) return { total: this.data.concours.length };
        if (query.includes('COUNT(*) as count FROM concours')) return { count: this.data.concours.length };
        if (query.includes('COUNT(*) as count FROM emplois')) return { count: this.data.emplois.length };
        if (query.includes('COUNT(*) as count FROM articles')) return { count: this.data.articles.length };
        if (query.includes('SUM(vues) as total FROM concours')) return { total: this.data.concours.reduce((s, c) => s + c.vues, 0) };
        if (query.includes('SUM(vues) as total FROM articles')) return { total: this.data.articles.reduce((s, a) => s + a.vues, 0) };
        return null;
      },
      run: (...args) => {
        console.log('ARGS (run):', args);
        if (query.includes('INSERT INTO concours')) {
          const id = this.data.concours.length > 0 ? Math.max(...this.data.concours.map(c => c.id)) + 1 : 1;
          this.data.concours.push({ id, titre: args[0], slug: args[1], description: args[2], categorie: args[3], date_limite: args[4], lien_source: args[5], vues: 0, created_at: new Date().toISOString() });
          this.save();
          return { lastInsertRowid: id };
        }
        if (query.includes('UPDATE concours SET vues')) {
          const item = this.data.concours.find(c => c.slug === args[0]);
          if (item) { item.vues += 1; this.save(); }
          return { changes: 1 };
        }
        if (query.includes('UPDATE concours')) {
          const item = this.data.concours.find(c => c.id == args[5]);
          if (item) {
            item.titre = args[0]; item.description = args[1]; item.categorie = args[2]; item.date_limite = args[3]; item.lien_source = args[4];
            this.save();
          }
          return { changes: 1 };
        }
        if (query.includes('DELETE FROM concours')) {
          this.data.concours = this.data.concours.filter(c => c.id != args[0]);
          this.save(); return { changes: 1 };
        }

        if (query.includes('INSERT INTO emplois')) {
          const id = this.data.emplois.length > 0 ? Math.max(...this.data.emplois.map(e => e.id)) + 1 : 1;
          this.data.emplois.push({ id, titre: args[0], entreprise: args[1], localisation: args[2], description: args[3], lien_candidature: args[4], created_at: new Date().toISOString() });
          this.save(); return { lastInsertRowid: id };
        }
        if (query.includes('UPDATE emplois')) {
          const item = this.data.emplois.find(e => e.id == args[5]);
          if (item) {
            item.titre = args[0]; item.entreprise = args[1]; item.localisation = args[2]; item.description = args[3]; item.lien_candidature = args[4];
            this.save();
          }
          return { changes: 1 };
        }
        if (query.includes('DELETE FROM emplois')) {
          this.data.emplois = this.data.emplois.filter(e => e.id != args[0]);
          this.save(); return { changes: 1 };
        }

        if (query.includes('INSERT INTO articles')) {
          const id = this.data.articles.length > 0 ? Math.max(...this.data.articles.map(a => a.id)) + 1 : 1;
          this.data.articles.push({ id, titre: args[0], slug: args[1], contenu: args[2], tags: args[3], vues: 0, created_at: new Date().toISOString() });
          this.save(); return { lastInsertRowid: id };
        }
        if (query.includes('UPDATE articles SET vues')) {
          const item = this.data.articles.find(c => c.slug === args[0]);
          if (item) { item.vues += 1; this.save(); }
          return { changes: 1 };
        }
        if (query.includes('UPDATE articles')) {
          const item = this.data.articles.find(a => a.id == args[3]);
          if (item) {
            item.titre = args[0]; item.contenu = args[1]; item.tags = args[2];
            this.save();
          }
          return { changes: 1 };
        }
        if (query.includes('DELETE FROM articles')) {
          this.data.articles = this.data.articles.filter(a => a.id != args[0]);
          this.save(); return { changes: 1 };
        }
        return { changes: 0, lastInsertRowid: 0 };
      }
    };
  }
};

module.exports = db;
