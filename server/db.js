const fs = require('fs');
const path = require('path');
const { isExpired } = require('./utils/dateParser');
const dns = require('dns');
const https = require('https');
const bcrypt = require('bcryptjs');

// ─── Sanitize MONGODB_URI once at module load ────────────────────────────────
// Vercel env vars pasted from dashboards often contain trailing spaces, hidden
// newlines (\n, \r), or wrapping quotes (""/''). The MongoDB driver treats these
// as part of the connection string, causing silent auth/DNS failures.
let mongoUri = process.env.MONGODB_URI;
if (mongoUri) {
  const rawLength = mongoUri.length;
  mongoUri = mongoUri.trim().replace(/^["']|["']$/g, '').replace(/[\r\n]+/g, '');
  if (mongoUri.length !== rawLength) {
    console.warn(`⚠️  MONGODB_URI was sanitized: removed ${rawLength - mongoUri.length} hidden char(s) (spaces/quotes/newlines).`);
  }
}
let originalMongoUri = mongoUri;
let expandedMongoUri = null;

let _mongoUriConfigured = false;

function dohLookup(provider, name, type) {
  const url = `${provider}?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`;

  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { accept: 'application/dns-json' }, timeout: 8000 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`DNS-over-HTTPS ${type} lookup failed with HTTP ${res.statusCode}`));
          return;
        }

        try {
          resolve(JSON.parse(body).Answer || []);
        } catch (err) {
          reject(new Error(`DNS-over-HTTPS ${type} response was not valid JSON: ${err.message}`));
        }
      });
    });

    req.on('timeout', () => req.destroy(new Error(`DNS-over-HTTPS ${type} lookup timed out`)));
    req.on('error', reject);
  });
}

async function lookupWithDoh(name, type) {
  const providers = ['https://cloudflare-dns.com/dns-query', 'https://dns.google/resolve'];
  let lastError;

  for (const provider of providers) {
    try {
      return await dohLookup(provider, name, type);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error(`DNS-over-HTTPS ${type} lookup failed`);
}

function parseTxtOptions(answer) {
  return (answer.data || '').replace(/^"|"$/g, '').replace(/"\s+"/g, '').trim();
}

function withMongoParams(uri, entries) {
  const [base, query = ''] = uri.split('?');
  const params = new URLSearchParams(query);

  for (const [key, value] of Object.entries(entries)) {
    params.set(key, value);
  }

  return `${base}?${params.toString()}`;
}

function applyMongoTlsCompatibility(uri) {
  if (process.env.MONGODB_TLS_COMPAT === 'false') return uri;

  return withMongoParams(uri, {
    tls: 'true',
    tlsInsecure: 'true',
  });
}

async function expandMongoSrvUri(uri) {
  const parsed = new URL(uri);
  const hostname = parsed.hostname;
  const srvName = `_mongodb._tcp.${hostname}`;
  const srvAnswers = await lookupWithDoh(srvName, 'SRV');
  const hosts = srvAnswers
    .map(answer => String(answer.data || '').trim().split(/\s+/))
    .filter(parts => parts.length >= 4)
    .map(parts => `${parts[3].replace(/\.$/, '')}:${parts[2]}`);

  if (hosts.length === 0) {
    throw new Error(`No SRV records found for ${srvName}`);
  }

  const params = new URLSearchParams(parsed.searchParams);
  const txtAnswers = await lookupWithDoh(hostname, 'TXT').catch(err => {
    console.warn(`MongoDB TXT lookup skipped: ${err.message}`);
    return [];
  });

  for (const answer of txtAnswers) {
    const txtParams = new URLSearchParams(parseTxtOptions(answer));
    for (const [key, value] of txtParams.entries()) {
      if (!params.has(key)) params.set(key, value);
    }
  }

  if (!params.has('tls') && !params.has('ssl')) {
    params.set('tls', 'true');
  }

  const auth = parsed.username
    ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ''}@`
    : '';
  const pathPart = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
  const query = params.toString();

  return `mongodb://${auth}${hosts.join(',')}${pathPart}${query ? `?${query}` : ''}`;
}

async function configureMongoUri() {
  if (_mongoUriConfigured || !mongoUri) return;
  _mongoUriConfigured = true;

  if (!mongoUri.startsWith('mongodb+srv://')) {
    mongoUri = applyMongoTlsCompatibility(mongoUri);
    process.env.MONGODB_URI = mongoUri;
    return;
  }

  const dnsServers = (process.env.MONGODB_DNS_SERVERS || '1.1.1.1,8.8.8.8')
    .split(',')
    .map(server => server.trim())
    .filter(Boolean);

  if (dnsServers.length > 0) {
    dns.setServers(dnsServers);
  }

  if (process.env.MONGODB_EXPAND_SRV === 'false') return;

  try {
    expandedMongoUri = await expandMongoSrvUri(mongoUri);
    mongoUri = expandedMongoUri;
    process.env.MONGODB_URI = mongoUri;
    console.log('Expanded MongoDB SRV URI through DNS-over-HTTPS.');
  } catch (err) {
    console.warn(`MongoDB SRV expansion skipped: ${err.message}`);
  }

  mongoUri = applyMongoTlsCompatibility(mongoUri);
  process.env.MONGODB_URI = mongoUri;
}

function getMongoUriCandidates() {
  return [
    originalMongoUri,
    originalMongoUri && applyMongoTlsCompatibility(originalMongoUri),
    expandedMongoUri,
    expandedMongoUri && applyMongoTlsCompatibility(expandedMongoUri),
    mongoUri,
    mongoUri && applyMongoTlsCompatibility(mongoUri),
  ].filter((uri, index, list) => uri && list.indexOf(uri) === index);
}

function redactMongoUri(uri) {
  return uri
    ? uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')
    : '(undefined)';
}
// ─────────────────────────────────────────────────────────────────────────────

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

// ─── Serverless MongoDB Connection Cache ────────────────────────────────────
// Vercel reuses Node.js module scope between warm invocations on the same
// container, so caching the MongoClient here avoids a new connection on every
// request (which would exhaust the Atlas free-tier connection pool).
let _cachedClient = null;
let _cachedCollection = null;

async function getMongoCollection() {
  if (_cachedCollection) return _cachedCollection;          // reuse warm connection

  await configureMongoUri();
  const { MongoClient } = require('mongodb');
  const options = {
    maxPoolSize: 5,           // keep pool small for serverless
    minPoolSize: 0,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
    socketTimeoutMS: 10000,
    tls: true,
  };

  let lastConnectionError = null;
  try {
    for (const candidateUri of getMongoUriCandidates()) {
      console.log('🔑 Trying MONGODB_URI:', redactMongoUri(candidateUri));
      const client = new MongoClient(candidateUri, options);

      try {
        await client.connect();
        _cachedClient = client;
        mongoUri = candidateUri;
        process.env.MONGODB_URI = candidateUri;
        lastConnectionError = null;
        break;
      } catch (candidateErr) {
        lastConnectionError = candidateErr;
        await client.close().catch(() => {});
        console.error('MongoDB candidate failed:', candidateErr.message);
      }
    }

    if (!_cachedClient) {
      throw lastConnectionError || new Error('No MongoDB URI candidates were available.');
    }
  } catch (connErr) {
    // ── CRITICAL: Surface the EXACT reason MongoDB failed ──────────────
    console.error('══════════════════════════════════════════════════════════');
    console.error('MONGODB_CONNECTION_ERROR:', connErr.message);
    console.error('Error name :', connErr.name);
    console.error('Error code :', connErr.code || connErr.codeName || 'N/A');
    console.error('Stack trace:', connErr.stack);
    console.error('══════════════════════════════════════════════════════════');
    // Reset cached refs so a future warm invocation can retry cleanly
    _cachedClient = null;
    _cachedCollection = null;
    throw connErr;   // re-throw so init() catch block handles the fallback
  }

  _cachedCollection = _cachedClient.db().collection('store');
  console.log('🔌 MongoDB Atlas — new connection established (will be reused).');
  return _cachedCollection;
}
// ────────────────────────────────────────────────────────────────────────────

const db = {
  data: JSON.parse(JSON.stringify(defaultData)),   // safe deep-clone of defaults
  storageMode: 'memory',                           // 'mongodb' | 'local' | 'memory'
  pendingSave: null,
  lastMongoError: null,

  init: async function() {
    if (mongoUri) {
      try {
        this.collection = await getMongoCollection();
        const doc = await this.collection.findOne({ _id: 'main_db' });
        if (doc && doc.data) {
          this.data = doc.data;
          this.storageMode = 'mongodb';
          this.lastMongoError = null;
          console.log('✅ Loaded data from MongoDB Atlas!');
        } else {
          // First-ever run — seed the database with default data + admin user
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
          this.storageMode = 'mongodb';
          this.lastMongoError = null;
          console.log('✅ Seeded MongoDB Atlas with default data and admin user.');
        }
      } catch (err) {
        console.error('══════════════════════════════════════════════════════════');
        console.error('❌ MongoDB Atlas INIT FAILED — falling back to local/memory.');
        console.error('MONGODB_CONNECTION_ERROR:', err.message, err.stack);
        console.error('Error code:', err.code || err.codeName || 'N/A');
        this.lastMongoError = {
          message: err.message,
          name: err.name,
          code: err.code || err.codeName || null
        };
        if (err.message && err.message.includes('Authentication failed')) {
          console.error('💡 HINT: Check your MONGODB_URI username/password in Vercel env vars.');
        } else if (err.message && (err.message.includes('ETIMEDOUT') || err.message.includes('connect ECONNREFUSED') || err.message.includes('Server selection timed out') || err.message.includes('tlsv1 alert internal error'))) {
          console.error('💡 HINT: Your IP is likely NOT whitelisted in MongoDB Atlas.');
          console.error('   → Go to Atlas > Network Access > Add 0.0.0.0/0 to allow all IPs (required for Vercel).');
        } else if (err.message && err.message.includes('querySrv ENOTFOUND')) {
          console.error('💡 HINT: The cluster hostname in MONGODB_URI cannot be resolved. Check the connection string.');
        }
        console.error('══════════════════════════════════════════════════════════');
        this.loadLocal();
      }
    } else {
      if (process.env.VERCEL) {
        // Running on Vercel without a database — data will not persist between requests!
        console.warn('');
        console.warn('⚠️  ════════════════════════════════════════════════════════');
        console.warn('⚠️  ATTENTION: MONGODB_URI is NOT set in Vercel environment!');
        console.warn('⚠️  Data scraped in this request WILL BE LOST when this');
        console.warn('⚠️  serverless function cold-starts again.');
        console.warn('⚠️  ');
        console.warn('⚠️  ACTION REQUIRED → Go to:');
        console.warn('⚠️  Vercel Dashboard > Your Project > Settings > Environment Variables');
        console.warn('⚠️  and add:  MONGODB_URI = <your MongoDB Atlas connection string>');
        console.warn('⚠️  ════════════════════════════════════════════════════════');
        console.warn('');
        this.storageMode = 'memory';
      } else {
        this.loadLocal();
      }
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
      try {
        fs.writeFileSync(dbPath, JSON.stringify(initData, null, 2));
        console.log('✅ DB JSON initialisée avec admin@atlasconcours.ma / Admin2026!');
      } catch (e) {
        // Read-only filesystem (e.g. Vercel serverless) — use in-memory default data
        console.warn('⚠️ Cannot write db.json (read-only FS), using in-memory data:', e.code);
        this.data = initData;
        return;
      }
    }
    try {
      this.data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      console.log('✅ Loaded data from local db.json!');
    } catch (e) {
      console.warn('⚠️ Cannot read db.json, using default in-memory data:', e.code);
    }
  },

  save: function() {
    if (mongoUri && this.collection) {
      this.pendingSave = this.collection.updateOne(
        { _id: 'main_db' },
        { $set: { data: this.data } },
        { upsert: true }
      )
        .then(() => console.log('💾 Saved to MongoDB Atlas!'))
        .catch(err => console.error('❌ Error saving to MongoDB Atlas:', err.message));
      return this.pendingSave;
    } else {
      try {
        fs.writeFileSync(dbPath, JSON.stringify(this.data, null, 2));
        console.log('💾 Saved to local db.json!');
        this.pendingSave = Promise.resolve();
      } catch (e) {
        // Silently skip on read-only filesystems (Vercel serverless)
        console.warn('⚠️ Cannot write db.json (read-only FS), changes are in-memory only:', e.code);
        this.pendingSave = Promise.resolve();
      }
    }
    return this.pendingSave;
  },

  flush: async function() {
    if (this.pendingSave) {
      await this.pendingSave;
    }

    if (mongoUri && this.collection && this.storageMode === 'mongodb') {
      await this.collection.updateOne(
        { _id: 'main_db' },
        { $set: { data: this.data } },
        { upsert: true }
      );
      console.log('💾 MongoDB Atlas flush confirmed.');
    }
  },

  
  prepare: function(query) {
    console.log('SQL:', query);
    return {
      all: (...args) => {
        console.log('ARGS:', args);
        if (query.includes('FROM concours')) {
          // Only serve active (non-expired) concours — expired ones are silently dropped
          let list = this.data.concours.filter(c => !isExpired(c.date_limite));
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
          return list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
          ).slice(offset, offset + limit);
        }
        if (query.includes('FROM emplois')) {
          // Only serve active (non-expired) emplois — expired ones are silently dropped
          let list = this.data.emplois.filter(e => !isExpired(e.date_limite || e.deadline));
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
            return list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
            ).slice(offset, offset + limit);
          }
          return list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        }
        if (query.includes('FROM articles')) {
          let list = this.data.articles;
          const stringParams = args.filter(a => typeof a === 'string' && a.startsWith('%'));
          for (const param of stringParams) {
             const term = param.replace(/%/g, '').toLowerCase();
             list = list.filter(a =>
               (a.titre && a.titre.toLowerCase().includes(term)) ||
               (a.contenu && a.contenu.toLowerCase().includes(term)) ||
               (a.tags && a.tags.toLowerCase().includes(term))
             );
          }
          if (query.includes('LIMIT ? OFFSET ?')) {
            const limit = typeof args[args.length - 2] === 'number' ? args[args.length - 2] : 9;
            const offset = typeof args[args.length - 1] === 'number' ? args[args.length - 1] : 0;
            return list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(offset, offset + limit);
          }
          return list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
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
        
        if (query.includes('COUNT(*) as total FROM concours')) return { total: this.data.concours.filter(c => !isExpired(c.date_limite)).length };
        if (query.includes('COUNT(*) as count FROM concours')) return { count: this.data.concours.filter(c => !isExpired(c.date_limite)).length };
        if (query.includes('COUNT(*) as count FROM emplois')) return { count: this.data.emplois.filter(e => !isExpired(e.date_limite || e.deadline)).length };
        if (query.includes('COUNT(*) as count FROM articles')) return { count: this.data.articles.length };
        if (query.includes('SUM(vues) as total FROM concours')) return { total: this.data.concours.reduce((s, c) => s + c.vues, 0) };
        if (query.includes('SUM(vues) as total FROM articles')) return { total: this.data.articles.reduce((s, a) => s + a.vues, 0) };
        return null;
      },
      run: (...args) => {
        console.log('ARGS (run):', args);
        if (query.includes('INSERT INTO concours')) {
          const id = this.data.concours.length > 0 ? Math.max(...this.data.concours.map(c => c.id)) + 1 : 1;
          this.data.concours.push({ id, titre: args[0], slug: args[1], description: args[2], categorie: args[3], date_limite: args[4], lien_source: args[5], imageUrl: args[6] || '', postes: args[7] || '', diplome: args[8] || '', texte_complet: args[9] || '', localisation: args[10] || '', vues: 0, created_at: new Date().toISOString() });
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
          this.data.emplois.push({ id, titre: args[0], entreprise: args[1], localisation: args[2], description: args[3], lien_candidature: args[4], imageUrl: args[5] || '', postes: args[6] || '', diplome: args[7] || '', deadline: args[8] || '', texte_complet: args[9] || '', created_at: new Date().toISOString() });
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
  },

  /**
   * Force a fresh read from MongoDB Atlas, overwriting the in-memory cache.
   * Call this at the top of any route that must return real-time data.
   * Safe to call in local/memory mode — it is a no-op when not connected to Atlas.
   */
  syncFromAtlas: async function() {
    if (this.storageMode === 'mongodb' && this.collection) {
      const doc = await this.collection.findOne({ _id: 'main_db' });
      if (doc && doc.data) {
        this.data = doc.data;
      }
    }
  },
};

module.exports = db;
