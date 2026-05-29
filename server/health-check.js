require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const https = require('https');
const http  = require('http');

const BASE = (process.env.PRODUCTION_BASE_URL || 'https://atlasconcours.vercel.app').replace(/\/+$/, '');

// ── helpers ─────────────────────────────────────────────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { timeout: 15000 }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}

function fetchHead(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: 'HEAD', timeout: 10000 }, res => {
      resolve({ status: res.statusCode, location: res.headers.location });
    });
    req.on('error', e => resolve({ status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
    req.end();
  });
}

function pass(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.log(`  ❌ ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); }
function section(title) { console.log(`\n${'─'.repeat(54)}\n📋 ${title}\n${'─'.repeat(54)}`); }

// ── main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('====================================================');
  console.log('🏥  END-TO-END HEALTH CHECK');
  console.log(`    Target: ${BASE}`);
  console.log('====================================================');

  let totalPassed = 0, totalFailed = 0;

  // ── 1. API Health Endpoint ────────────────────────────────────────────────
  section('1 · API Health');
  const health = await fetchJson(`${BASE}/api/health`);
  if (health.status === 200) {
    pass(`/api/health → HTTP ${health.status}`);
    totalPassed++;
    const d = health.data;
    console.log(`     storageMode : ${d.storageMode}`);
    console.log(`     persistent  : ${d.persistent}`);
    console.log(`     concours    : ${d.records?.concours ?? 'N/A'}`);
    console.log(`     emplois     : ${d.records?.emplois  ?? 'N/A'}`);
    if (!d.persistent) { fail('MongoDB NOT connected — data will not persist!'); totalFailed++; }
    else { pass('MongoDB Atlas connected and persistent'); totalPassed++; }
  } else {
    fail(`/api/health returned HTTP ${health.status}`); totalFailed++;
  }

  // ── 2. Emplois Count & Sample ─────────────────────────────────────────────
  section('2 · Emplois API (Frontend Data)');
  const emploisRes = await fetchJson(`${BASE}/api/emplois?limit=25&offset=0`);
  if (emploisRes.status === 200) {
    const list = emploisRes.data?.data || emploisRes.data?.emplois || [];
    const total = emploisRes.data?.total ?? list.length;
    pass(`/api/emplois → HTTP 200, total=${total}, returned=${list.length}`);
    totalPassed++;
    if (total >= 25) { pass(`≥25 emplois in DB (expected ~25)`); totalPassed++; }
    else { warn(`Only ${total} emplois in DB — expected ~25`); }

    // Spot-check last 5 entries for required fields
    const last5 = list.slice(-5);
    let fieldErrors = 0;
    last5.forEach((e, i) => {
      const missingFields = ['titre','lien_candidature','created_at'].filter(f => !e[f]);
      if (missingFields.length) {
        fail(`emploi[${i}] missing fields: ${missingFields.join(', ')}`);
        fieldErrors++; totalFailed++;
      }
    });
    if (fieldErrors === 0) { pass('All sampled emplois have required fields'); totalPassed++; }
  } else {
    fail(`/api/emplois returned HTTP ${emploisRes.status}`); totalFailed++;
  }

  // ── 3. Concours Count & Sample ────────────────────────────────────────────
  section('3 · Concours API (Frontend Data)');
  const concoursRes = await fetchJson(`${BASE}/api/concours?limit=13&offset=0`);
  if (concoursRes.status === 200) {
    const list = concoursRes.data?.data || concoursRes.data?.concours || [];
    const total = concoursRes.data?.total ?? list.length;
    pass(`/api/concours → HTTP 200, total=${total}, returned=${list.length}`);
    totalPassed++;
    if (total >= 13) { pass(`≥13 concours in DB (expected ~13)`); totalPassed++; }
    else { warn(`Only ${total} concours in DB — expected ~13`); }

    let fieldErrors = 0;
    list.slice(0, 5).forEach((c, i) => {
      const missingFields = ['titre','slug','lien_source','created_at'].filter(f => !c[f]);
      if (missingFields.length) {
        fail(`concours[${i}] missing fields: ${missingFields.join(', ')}`);
        fieldErrors++; totalFailed++;
      }
    });
    if (fieldErrors === 0) { pass('All sampled concours have required fields'); totalPassed++; }
  } else {
    fail(`/api/concours returned HTTP ${concoursRes.status}`); totalFailed++;
  }

  // ── 4. Live URL Audit — last 5 emplois ───────────────────────────────────
  section('4 · Live Detail-Page Link Audit (last 5 emplois)');
  const emploisAll = await fetchJson(`${BASE}/api/emplois?limit=5&offset=0`);
  const emploisList = emploisAll.data?.data || emploisAll.data?.emplois || [];
  const last5e = Array.isArray(emploisList) ? emploisList.slice(0, 5) : [];
  for (const e of last5e) {
    const id = e.id;
    const url = `${BASE}/jobs/${id}`;
    // Check the API endpoint the frontend actually calls
    const apiUrl = `${BASE}/api/emplois/${id}`;
    const apiRes = await fetchJson(apiUrl);
    if (apiRes.status === 200 && apiRes.data?.titre) {
      pass(`emploi id=${id} → ${apiUrl} → 200 ✔`);
      totalPassed++;
    } else {
      fail(`emploi id=${id} → ${apiUrl} → HTTP ${apiRes.status}`);
      totalFailed++;
    }
    console.log(`     Title : ${(e.titre || '').slice(0, 60)}`);
    console.log(`     Link  : ${e.lien_candidature?.slice(0, 70) || 'N/A'}`);
  }

  // ── 5. Live URL Audit — last 5 concours ──────────────────────────────────
  section('5 · Live Detail-Page Link Audit (last 5 concours)');
  const concoursAll = await fetchJson(`${BASE}/api/concours?limit=5&offset=0`);
  const concoursList = concoursAll.data?.data || concoursAll.data?.concours || [];
  const last5c = Array.isArray(concoursList) ? concoursList.slice(0, 5) : [];
  for (const c of last5c) {
    const slug = c.slug;
    const apiUrl = `${BASE}/api/concours/${slug}`;
    const apiRes = await fetchJson(apiUrl);
    if (apiRes.status === 200 && apiRes.data?.titre) {
      pass(`concours slug=${slug?.slice(0,40)} → 200 ✔`);
      totalPassed++;
    } else {
      fail(`concours slug=${slug?.slice(0,40)} → HTTP ${apiRes.status}`);
      totalFailed++;
    }
    console.log(`     Title : ${(c.titre || '').slice(0, 60)}`);
  }

  // ── 6. Cron Config Audit ──────────────────────────────────────────────────
  section('6 · Vercel Cron Configuration Audit');
  const fs = require('fs'), path = require('path');
  const vercelPath = path.join(__dirname, '../vercel.json');
  const vercelConfig = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
  const crons = vercelConfig.crons || [];
  if (crons.length === 0) {
    fail('No crons defined in vercel.json!'); totalFailed++;
  } else {
    pass(`${crons.length} cron job(s) registered`); totalPassed++;
    crons.forEach(c => console.log(`     ${c.schedule.padEnd(15)} → ${c.path}`));
  }
  const maxDuration = vercelConfig.functions?.['server/index.js']?.maxDuration;
  if (maxDuration) {
    pass(`maxDuration=${maxDuration}s set for server/index.js`); totalPassed++;
  } else {
    warn('maxDuration not set — cron may timeout on large scrapes');
  }

  // ── 7. Scraper Source Reachability ────────────────────────────────────────
  section('7 · Source Site Reachability');
  const sources = [
    { label: 'ANAPEC', url: 'https://www.anapec.org/sigec-app-rv/fr/chercheurs/resultat_recherche/tout:all' },
    { label: 'EmploiPublic Concours', url: 'https://www.emploi-public.ma/fr/concours-liste' },
    { label: 'EmploiPublic Jobs',     url: 'https://www.emploi-public.ma/fr/emploi-sup-liste' },
  ];
  for (const s of sources) {
    const r = await fetchHead(s.url);
    if (r.status >= 200 && r.status < 400) {
      pass(`${s.label} → HTTP ${r.status}`); totalPassed++;
    } else {
      fail(`${s.label} → HTTP ${r.status || r.error}`); totalFailed++;
    }
  }

  // ── Final Score ───────────────────────────────────────────────────────────
  console.log('\n====================================================');
  const score = `${totalPassed}/${totalPassed + totalFailed}`;
  const icon  = totalFailed === 0 ? '🟢' : totalFailed <= 2 ? '🟡' : '🔴';
  console.log(`${icon}  HEALTH CHECK COMPLETE — ${score} checks passed`);
  if (totalFailed > 0) console.log(`   ${totalFailed} failure(s) require attention.`);
  else console.log('   System is 100% operational. ✅');
  console.log('====================================================\n');
  process.exit(totalFailed > 0 ? 1 : 0);
}

run().catch(err => { console.error('Health check crashed:', err); process.exit(1); });
