/**
 * One-time migration: fix broken ANAPEC employer-internal URLs stored in DB.
 * Old format: /sigec-app-rv/fr/entreprises/bloc_offre_home/{ID}/resultat_recherche
 * New format: /sigec-app-rv/fr/chercheurs/resultat_recherche/detail_offre/{ID}
 */
require('dotenv').config();
const db = require('./server/db');

const ANAPEC_BASE = 'https://www.anapec.org';

function fixAnapecUrl(url) {
  if (!url) return url;
  // Match the broken employer-facing URL pattern and extract the job ID
  const match = url.match(/anapec\.org\/sigec-app-rv\/fr\/entreprises\/bloc_offre_home\/(\d+)\//);
  if (!match) return url; // not a broken ANAPEC URL — leave it alone
  const jobId = match[1];
  return `${ANAPEC_BASE}/sigec-app-rv/fr/chercheurs/resultat_recherche/detail_offre/${jobId}`;
}

async function migrate() {
  await db.init();
  if (db.storageMode !== 'mongodb') {
    console.error('❌ Not connected to MongoDB Atlas. Check your .env MONGODB_URI.');
    process.exit(1);
  }

  let fixed = 0;
  db.data.emplois = db.data.emplois.map(e => {
    const newUrl = fixAnapecUrl(e.lien_candidature);
    if (newUrl !== e.lien_candidature) {
      console.log(`  ✅ Fixed: ${e.titre}`);
      console.log(`     OLD: ${e.lien_candidature}`);
      console.log(`     NEW: ${newUrl}`);
      fixed++;
      return { ...e, lien_candidature: newUrl };
    }
    return e;
  });

  if (fixed === 0) {
    console.log('✨ No broken ANAPEC URLs found. Nothing to migrate.');
    process.exit(0);
  }

  console.log(`\n📊 Migrated ${fixed} ANAPEC URLs. Saving to MongoDB Atlas...`);
  await db.save();
  await db.flush();
  console.log('💾 Atlas updated successfully!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
