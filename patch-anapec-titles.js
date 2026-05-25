/**
 * patch-anapec-titles.js
 * 
 * Fetches the current ANAPEC listing page, builds a map of jobId → realTitle,
 * then surgically updates any DB entries whose lien_candidature contains that
 * jobId but whose titre is still a reference code (alphanumeric pattern like
 * "ET2205261124908").
 */
require('dotenv').config();
const cheerio = require('cheerio');
const db = require('./server/db');

const REFERENCE_RE = /^[A-Z]{2}\d{10,}$/i;   // e.g. ET2205261124908, KH2205261124864

async function main() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  // 1. Sync DB from Atlas
  await db.init();
  await db.syncFromAtlas();
  console.log(`📦 Loaded ${db.data.emplois.length} emplois from Atlas.`);

  // 2. Fetch ANAPEC listing
  console.log('🌐 Fetching ANAPEC listing page...');
  const res = await fetch('https://www.anapec.org/sigec-app-rv/fr/chercheurs/resultat_recherche/tout:all', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  // 3. Build jobId → { title, location } map from the table
  const idToData = new Map();
  $('table tr').slice(1).each((i, el) => {
    const linkEl = $(el).find('a.nyroModal');
    if (!linkEl.length) return;
    const href = linkEl.attr('href') || '';
    const idMatch = href.match(/\/(\d{5,})\//);
    if (!idMatch) return;
    const jobId = idMatch[1];

    const tds = $(el).find('td');
    const reference = tds.length > 1 ? tds.eq(1).text().trim() : '';
    const titre     = tds.length > 3 ? tds.eq(3).text().trim().replace(/\s+/g, ' ') : '';
    const location  = tds.length > 6 ? tds.eq(6).text().trim() : (tds.length > 2 ? tds.eq(2).text().trim() : '');

    idToData.set(jobId, { title: titre || reference, location });
  });

  console.log(`📋 Found ${idToData.size} jobs on ANAPEC listing page.`);

  // 4. Patch stale DB entries
  let patchedCount = 0;
  for (const emploi of db.data.emplois) {
    if (!emploi.lien_candidature || !emploi.lien_candidature.includes('anapec.org')) continue;

    // Check if current title looks like a reference code
    const currentTitle = emploi.titre || '';
    const isRefCode = REFERENCE_RE.test(currentTitle.replace(/\s*\(Nouveau\)$/i, '').trim());

    if (!isRefCode) continue; // Title already looks correct, skip

    // Extract the numeric jobId from the link
    const jobIdMatch = emploi.lien_candidature.match(/\/(\d{5,})\//);
    if (!jobIdMatch) continue;
    const jobId = jobIdMatch[1];

    // Look up real title from the freshly fetched listing
    const fresh = idToData.get(jobId);
    if (!fresh || !fresh.title) {
      console.warn(`  ⚠️ No live data for jobId ${jobId} (current title: "${currentTitle}") — keeping as-is.`);
      continue;
    }

    const newTitle = fresh.title + ' (Nouveau)'; // keep the "(Nouveau)" suffix that Gemini fallback adds
    console.log(`  ✏️  [${jobId}] "${currentTitle}" → "${newTitle}"`);
    emploi.titre = newTitle;

    // Update location if it's a generic placeholder
    if (fresh.location && (!emploi.localisation || emploi.localisation === 'Maroc')) {
      emploi.localisation = fresh.location;
    }
    patchedCount++;
  }

  if (patchedCount === 0) {
    console.log('✅ No stale reference-code titles found. Database is already clean.');
    process.exit(0);
  }

  // 5. Save locally and upload to Vercel
  console.log(`\n💾 Saving ${patchedCount} patched entries...`);
  await db.save();

  console.log('🚀 Uploading patched data to Vercel production...');
  const uploadRes = await fetch('https://atlasconcours.vercel.app/api/debug/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(db.data)
  });
  const result = await uploadRes.text();
  console.log(`📡 Vercel response: ${result}`);
  console.log(`\n✅ Done! Patched ${patchedCount} ANAPEC job titles.`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
