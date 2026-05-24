require('dotenv').config();

const { sanitizeDescription } = require('./maintenance-sanitize-descriptions');

const BASE_URL = (process.env.PRODUCTION_BASE_URL || 'https://atlasconcours.vercel.app').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@atlasconcours.ma';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin2026!';

const BAD_PATTERN = /front_office\.accessibilite|Rechercher dans notre site|labelserach|input_search|\blogin\b|Mot de passe|Facebook|Linkedin|<[^>]+>|container_12 clearfix/i;

async function fetchJson(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${path}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }

  return body;
}

async function login() {
  const body = await fetchJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  if (!body?.token) {
    throw new Error('Admin login did not return a token.');
  }

  return body.token;
}

async function getAllRows(resource) {
  const first = await fetchJson(`/api/${resource}?limit=1&_verify=${Date.now()}`);
  const total = first.total || 0;
  const full = await fetchJson(`/api/${resource}?limit=${Math.max(total, 1)}&_verify=${Date.now()}`);
  return full.data || [];
}

async function sanitizeEmplois(token) {
  const rows = await getAllRows('emplois');
  let changed = 0;

  for (const row of rows) {
    const after = sanitizeDescription(row.description);
    if (after === row.description) continue;

    await fetchJson(`/api/emplois/${row.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        titre: row.titre,
        entreprise: row.entreprise || 'Administration',
        localisation: row.localisation || 'Maroc',
        description: after,
        lien_candidature: row.lien_candidature || '',
      }),
    });
    changed++;
  }

  return { total: rows.length, changed };
}

async function sanitizeConcours(token) {
  const rows = await getAllRows('concours');
  let changed = 0;

  for (const row of rows) {
    const detail = await fetchJson(`/api/concours/${row.id}?_verify=${Date.now()}`);
    const after = sanitizeDescription(detail.description);
    if (after === detail.description) continue;

    await fetchJson(`/api/concours/${detail.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        titre: detail.titre,
        description: after,
        categorie: detail.categorie || 'Concours',
        date_limite: detail.date_limite || '',
        lien_source: detail.lien_source || '',
      }),
    });
    changed++;
  }

  return { total: rows.length, changed };
}

async function verifyClean() {
  const results = {};

  for (const resource of ['emplois', 'concours']) {
    const rows = await getAllRows(resource);
    const polluted = [];

    for (const row of rows) {
      const desc = String(row.description || '');
      if (BAD_PATTERN.test(desc)) {
        polluted.push({
          id: row.id,
          title: row.titre,
          descLen: desc.length,
          sample: desc.slice(0, 180),
        });
      }
    }

    results[resource] = {
      total: rows.length,
      pollutedRemaining: polluted.length,
      polluted: polluted.slice(0, 10),
    };
  }

  return results;
}

async function main() {
  console.log(`Production API sanitizer target: ${BASE_URL}`);
  const token = await login();
  const before = await verifyClean();
  const emplois = await sanitizeEmplois(token);
  const concours = await sanitizeConcours(token);
  const after = await verifyClean();

  console.log(JSON.stringify({ before, changed: { emplois, concours }, after }, null, 2));

  if (after.emplois.pollutedRemaining || after.concours.pollutedRemaining) {
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
