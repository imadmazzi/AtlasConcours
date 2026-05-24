require('dotenv').config();

const cheerio = require('cheerio');
const db = require('./db');

const NOISE_PATTERNS = [
  /front_office\.accessibilite[a-zA-Z0-9_.-]*/gi,
  /Rechercher dans notre site/gi,
  /labelserach/gi,
  /input_search/gi,
  /\blogin\b/gi,
  /Mot de passe/gi,
  /Facebook/gi,
  /Linkedin/gi,
  /Twitter/gi,
  /Viadeo/gi,
  /Accueil\s+Concours de recrutement/gi,
  /Dépôt en ligne/gi,
];

const LAYOUT_SELECTORS = [
  'script',
  'style',
  'iframe',
  'svg',
  'img',
  'link',
  'meta',
  'noscript',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'nav',
  'header',
  'footer',
  '#header',
  '#footer',
  '#accessPanel',
  '.navbar',
  '.breadcrumb',
  '.pagination',
  '.sidebar',
  '.loader-d',
  '.rs_addtools',
  '.labelserach',
  '.input_search',
  '.search',
  '.social',
  '.login',
  '.connexion',
  '.auth',
  '.menu',
  '.main-menu',
  '.card--btn',
  '.share',
  '.footer',
  '.header',
];

const DETAIL_SELECTORS = [
  '.offres-details',
  '.detail-offre',
  '.bloc_offre_home',
  '.detail-content',
  '.detail-annonce',
  '.annonce-detail',
  '.content-detail',
  '.fiche-detail',
  '.card-body',
  'article.detail',
  'main',
  'article',
  'body',
];

function decodeEntities(value) {
  return cheerio.load('<textarea></textarea>')('textarea').html(value || '').text();
}

function normalizeText(text) {
  let cleaned = decodeEntities(String(text || ''));

  for (const pattern of NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ');
  }

  cleaned = cleaned
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\{[^{}]*(?:flash|swf|nyroModal|accessibilite|serach)[^{}]*\}/gi, ' ')
    .replace(/\b(?:function|var)\s+[a-zA-Z0-9_$]+\s*\([^)]*\)\s*\{[\s\S]{0,500}?\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const hardNoiseIndex = cleaned.search(/(?:Rechercher dans notre site|labelserach|input_search|Facebook|Linkedin|Mot de passe|front_office\.accessibilite|container_12 clearfix)/i);
  if (hardNoiseIndex >= 0) {
    cleaned = cleaned.slice(hardNoiseIndex + 1).replace(/\s+/g, ' ').trim();
  }

  return cleaned;
}

function scoreText(text) {
  const value = normalizeText(text);
  if (!value) return -10000;

  let score = Math.min(value.length, 5000);
  if (/Détail de l'annonce|Administration qui recrute|Type de contrat|Description de l'entreprise|Compétences|Formation|Profil/i.test(value)) {
    score += 3000;
  }
  if (/Rechercher dans notre site|labelserach|input_search|Facebook|Linkedin|Mot de passe|front_office\.accessibilite|container_12 clearfix/i.test(value)) {
    score -= 8000;
  }
  return score;
}

function pickBestText($) {
  let best = '';
  let bestScore = -Infinity;

  for (const selector of DETAIL_SELECTORS) {
    $(selector).each((_, el) => {
      const candidate = $(el).text();
      const score = scoreText(candidate);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    });
  }

  return normalizeText(best || $.root().text());
}

function sanitizeDescription(description) {
  const raw = String(description || '');
  if (!raw.trim()) return 'Détails non disponibles.';

  const $ = cheerio.load(raw, { decodeEntities: true });
  LAYOUT_SELECTORS.forEach(selector => $(selector).remove());

  let text = pickBestText($);

  const usefulStart = text.search(/(?:Détail de l'annonce|Administration qui recrute|Description de l'entreprise|Compétences|Formation|Type de contrat|Poste|Profil|Mission|Nombre de postes?|Grade|Diplôme|Date limite)/i);
  if (usefulStart > 0) {
    text = text.slice(usefulStart).trim();
  }

  text = normalizeText(text);

  if (!text || text.length < 20) {
    return 'Détails non disponibles.';
  }

  return text.slice(0, 6000);
}

function auditRows(rows) {
  const bad = /front_office\.accessibilite|Rechercher dans notre site|labelserach|input_search|\blogin\b|Mot de passe|Facebook|Linkedin|<[^>]+>|container_12 clearfix/i;
  return (rows || []).filter(row => bad.test(String(row.description || '')));
}

function sanitizeRows(rows) {
  let changed = 0;

  for (const row of rows || []) {
    const before = String(row.description || '');
    const after = sanitizeDescription(before);
    if (after !== before) {
      row.description = after;
      changed++;
    }
  }

  return changed;
}

async function sanitizeDirectCollections(collection, names) {
  const results = [];

  for (const name of names) {
    const exists = await collection.db.listCollections({ name }).hasNext();
    if (!exists) {
      results.push({ collection: name, exists: false });
      continue;
    }

    const target = collection.db.collection(name);
    const rows = await target.find({}).toArray();
    let changed = 0;

    for (const row of rows) {
      const after = sanitizeDescription(row.description);
      if (after !== row.description) {
        await target.updateOne({ _id: row._id }, { $set: { description: after } });
        changed++;
      }
    }

    const afterRows = await target.find({}).toArray();
    results.push({
      collection: name,
      exists: true,
      total: afterRows.length,
      changed,
      pollutedRemaining: auditRows(afterRows).length,
    });
  }

  return results;
}

async function main() {
  await db.init();

  if (db.storageMode !== 'mongodb') {
    throw new Error(`MongoDB Atlas connection required. Active storage mode: ${db.storageMode}`);
  }

  const beforeEmplois = auditRows(db.data.emplois);
  const beforeConcours = auditRows(db.data.concours);

  const changedEmplois = sanitizeRows(db.data.emplois);
  const changedConcours = sanitizeRows(db.data.concours);

  await db.save();
  await db.flush();
  await db.syncFromAtlas();

  const afterEmplois = auditRows(db.data.emplois);
  const afterConcours = auditRows(db.data.concours);

  const directCollections = await sanitizeDirectCollections(db.collection, ['emplois', 'concours']);

  console.log(JSON.stringify({
    storageMode: db.storageMode,
    appState: {
      emplois: {
        total: db.data.emplois.length,
        pollutedBefore: beforeEmplois.length,
        changed: changedEmplois,
        pollutedRemaining: afterEmplois.length,
      },
      concours: {
        total: db.data.concours.length,
        pollutedBefore: beforeConcours.length,
        changed: changedConcours,
        pollutedRemaining: afterConcours.length,
      },
    },
    directCollections,
  }, null, 2));
}

module.exports = {
  auditRows,
  sanitizeDescription,
  sanitizeRows,
};

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err.stack || err.message);
      process.exit(1);
    });
}
