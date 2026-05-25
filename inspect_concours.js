require('dotenv').config();
const db = require('./server/db');

async function main() {
  await db.init();
  await db.syncFromAtlas();
  // Find a concours that has a long description (table content)
  const sorted = db.data.concours.sort((a,b) => (b.description||'').length - (a.description||'').length);
  const c = sorted[0];
  console.log('titre:', c.titre);
  console.log('date_limite:', c.date_limite);
  console.log('description length:', (c.description||'').length);
  console.log('\n--- Full description HTML ---');
  console.log(c.description.substring(0, 5000));
  process.exit(0);
}
main().catch(console.error);
