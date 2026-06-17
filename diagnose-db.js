require('dotenv').config();
const db = require('./server/db');
const { isExpired, parseDateLimite } = require('./server/utils/dateParser');

async function diagnose() {
  await db.init();

  const concours = db.data.concours;
  const emplois  = db.data.emplois;

  console.log(`\n=== CONCOURS (${concours.length} total) ===`);
  const expired   = concours.filter(c => isExpired(c.date_limite));
  const active    = concours.filter(c => !isExpired(c.date_limite));
  const noDate    = concours.filter(c => !c.date_limite);
  const badgeInTitle = concours.filter(c => (c.titre||'').includes('[Expiré]'));

  console.log(`  Active  : ${active.length}`);
  console.log(`  Expired : ${expired.length}`);
  console.log(`  No date : ${noDate.length}`);
  console.log(`  [Expiré] in titre : ${badgeInTitle.length}`);

  console.log('\n--- Sample of EXPIRED concours (date_limite formats) ---');
  expired.slice(0, 10).forEach(c => {
    const ts = parseDateLimite(c.date_limite);
    console.log(`  id=${c.id}  date_limite="${c.date_limite}"  parsed=${new Date(ts).toISOString()}  title="${(c.titre||'').substring(0,50)}"`);
  });

  console.log('\n--- Sample of NO-DATE concours ---');
  noDate.slice(0, 10).forEach(c => {
    console.log(`  id=${c.id}  title="${(c.titre||'').substring(0,60)}"`);
  });

  console.log('\n--- Concours with [Expiré] baked into title ---');
  badgeInTitle.slice(0, 10).forEach(c => {
    console.log(`  id=${c.id}  date_limite="${c.date_limite}"  isExp=${isExpired(c.date_limite)}  title="${(c.titre||'').substring(0,60)}"`);
  });

  console.log(`\n=== EMPLOIS (${emplois.length} total) ===`);
  const expEmp = emplois.filter(e => isExpired(e.date_limite || e.deadline));
  const actEmp = emplois.filter(e => !isExpired(e.date_limite || e.deadline));
  console.log(`  Active  : ${actEmp.length}`);
  console.log(`  Expired : ${expEmp.length}`);

  process.exit(0);
}

diagnose().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
