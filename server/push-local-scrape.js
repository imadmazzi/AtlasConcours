require('dotenv').config();

const PRODUCTION_BASE_URL = (process.env.PRODUCTION_BASE_URL || 'https://atlasconcours.vercel.app').replace(/\/+$/, '');
const PUSH_TOKEN = process.env.LOCAL_SCRAPE_PUSH_TOKEN || process.env.SCRAPE_PUSH_TOKEN || '';
const FORCE = !process.argv.includes('--no-force');
const ALLOW_EMPTY = process.argv.includes('--allow-empty');

// Force this helper to scrape into local db.json first. It must not connect to
// Atlas directly; the secure push endpoint is the only production write path.
delete process.env.MONGODB_URI;
process.env.VERCEL = '';

async function postJson(path, payload) {
  const res = await fetch(`${PRODUCTION_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${PUSH_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_) {
    // Keep the raw body for diagnostics.
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${path}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }

  return body;
}

async function main() {
  if (!PUSH_TOKEN) {
    throw new Error('LOCAL_SCRAPE_PUSH_TOKEN or SCRAPE_PUSH_TOKEN is required.');
  }

  const db = require('./db');
  await db.init();

  db.data.emplois = [];
  db.data.concours = [];
  await db.save();

  const { runAnapecScraper, runJobScraper, runScraper } = require('./scraper');
  const results = {
    anapec: await runAnapecScraper(FORCE),
    jobs: await runJobScraper(FORCE),
    concours: await runScraper(FORCE),
  };

  await db.flush();

  const emplois = db.data.emplois || [];
  const concours = db.data.concours || [];

  if (!ALLOW_EMPTY && (emplois.length === 0 || concours.length === 0)) {
    throw new Error(`Refusing to push incomplete scrape result: ${emplois.length} emplois, ${concours.length} concours. Use --allow-empty to override.`);
  }

  const pushed = await postJson('/api/admin/push-scrape', {
    emplois,
    concours,
    allowEmpty: ALLOW_EMPTY,
    meta: {
      pushedAt: new Date().toISOString(),
      source: 'push-local-scrape',
      results,
    },
  });

  console.log(JSON.stringify({
    scraped: {
      emplois: emplois.length,
      concours: concours.length,
      results,
    },
    pushed,
  }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
