/**
 * nuclear-wipe.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Connects directly to MongoDB Atlas
 * 2. Removes every concours/emploi where:
 *      a. date_limite is in the past (expired)
 *      b. titre contains '[Expiré]'
 *      c. date_limite is a clearly old date (anything before today)
 * 3. Also strips '[Expiré]' prefix from any titles that somehow still have it
 * 4. Saves the clean result back to Atlas
 * ─────────────────────────────────────────────────────────────────────────────
 * Run: node nuclear-wipe.js
 */
require('dotenv').config();
const db = require('./server/db');
const { isExpired } = require('./server/utils/dateParser');

const TODAY = new Date('2026-06-17T16:00:00Z'); // current date

function isDefinitelyExpired(item) {
  const d = item.date_limite || item.deadline || '';
  const t = item.titre || '';

  // 1. Title already has the badge baked in
  if (t.includes('[Expiré]') || t.includes('[Expire]') || t.includes('Expiré')) return true;

  // 2. dateParser says expired
  if (d && isExpired(d)) return true;

  // 3. ISO date string (YYYY-MM-DD) in the past
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) {
    const ts = Date.parse(d);
    if (!isNaN(ts) && ts < TODAY.getTime()) return true;
  }

  // 4. DD/MM/YYYY format
  const slashMatch = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    const ts = new Date(Number(yyyy), Number(mm) - 1, Number(dd), 23, 59, 59).getTime();
    if (ts < TODAY.getTime()) return true;
  }

  return false;
}

async function nuclearWipe() {
  await db.init();

  if (db.storageMode !== 'mongodb') {
    console.error('❌ Not connected to MongoDB! storageMode =', db.storageMode);
    process.exit(1);
  }

  const beforeC = db.data.concours.length;
  const beforeE = db.data.emplois.length;

  // --- Concours ---
  const activeC = db.data.concours.filter(c => !isDefinitelyExpired(c));
  const removedC = beforeC - activeC.length;

  // Strip any residual [Expiré] from titles in active set (safety)
  activeC.forEach(c => {
    c.titre = (c.titre || '').replace(/^\[Expir[eé]\]\s*/i, '').trim();
  });

  // --- Emplois ---
  const activeE = db.data.emplois.filter(e => !isDefinitelyExpired(e));
  const removedE = beforeE - activeE.length;

  activeE.forEach(e => {
    e.titre = (e.titre || '').replace(/^\[Expir[eé]\]\s*/i, '').trim();
  });

  console.log(`\n📊 Before: ${beforeC} concours, ${beforeE} emplois`);
  console.log(`🗑️  Removing: ${removedC} expired concours, ${removedE} expired emplois`);
  console.log(`✅ Keeping:  ${activeC.length} active concours, ${activeE.length} active emplois\n`);

  if (removedC === 0 && removedE === 0) {
    console.log('✨ Nothing to remove. Database is already clean!');
    process.exit(0);
  }

  db.data.concours = activeC;
  db.data.emplois  = activeE;

  await db.save();
  await db.flush();

  console.log('💾 Flushed clean data to MongoDB Atlas.');
  console.log('\n=== REMAINING ACTIVE CONCOURS (first 20) ===');
  activeC.slice(0, 20).forEach(c => {
    console.log(`  [${c.date_limite || 'no-date'}] ${(c.titre||'').substring(0, 70)}`);
  });

  process.exit(0);
}

nuclearWipe().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
