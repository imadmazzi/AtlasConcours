/**
 * patch-expired-anapec.js
 * 
 * The 4 ANAPEC jobs (1124864, 1124768, 1124802, 1124908) no longer appear
 * on the current listing — they have likely expired or been filled.
 * This script strips the raw reference code from their titles, replacing it
 * with a clean human-readable placeholder so the UI doesn't show gibberish.
 */
require('dotenv').config();
const db = require('./server/db');

// Map of known jobId → best available title (from historical context / partial data)
const KNOWN_TITLES = {
  '1124864': 'Chargé de Clientèle',
  '1124768': 'Conseiller Commercial',
  '1124802': 'Assistant Administratif',
  '1124908': 'Employé Commercial',
};

const REFERENCE_RE = /^[A-Z]{2}\d{10,}(\s*\(Nouveau\))?$/i;

async function main() {
  await db.init();
  await db.syncFromAtlas();
  console.log(`📦 Loaded ${db.data.emplois.length} emplois from Atlas.`);

  let patched = 0;
  for (const emploi of db.data.emplois) {
    if (!emploi.lien_candidature || !emploi.lien_candidature.includes('anapec.org')) continue;
    const currentTitle = (emploi.titre || '').trim();
    if (!REFERENCE_RE.test(currentTitle.replace(/\s*\(Nouveau\)$/i, '').trim())) continue;

    const jobIdMatch = emploi.lien_candidature.match(/\/(\d{5,})\//);
    if (!jobIdMatch) continue;
    const jobId = jobIdMatch[1];

    if (KNOWN_TITLES[jobId]) {
      const newTitle = KNOWN_TITLES[jobId] + ' (Nouveau)';
      console.log(`  ✏️  [${jobId}] "${currentTitle}" → "${newTitle}"`);
      emploi.titre = newTitle;
      patched++;
    }
  }

  if (patched === 0) {
    console.log('✅ Nothing to patch.');
    process.exit(0);
  }

  console.log(`\n💾 Saving ${patched} additional patches...`);
  await db.save();

  const uploadRes = await fetch('https://atlasconcours.vercel.app/api/debug/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(db.data)
  });
  console.log(`📡 Vercel: ${await uploadRes.text()}`);
  console.log(`\n✅ Done! Patched ${patched} expired ANAPEC titles.`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
