
require('dotenv').config();
const db = require('./server/db');

async function sync() {
  await db.init();
  const emplois = db.data.emplois || [];
  const concours = db.data.concours || [];

  const token = process.env.LOCAL_SCRAPE_PUSH_TOKEN || process.env.SCRAPE_PUSH_TOKEN;
  
  const CHUNK_SIZE = 50;
  
  console.log('Sending ' + emplois.length + ' emplois in chunks...');
  for (let i = 0; i < emplois.length; i += CHUNK_SIZE) {
    const chunk = emplois.slice(i, i + CHUNK_SIZE);
    console.log('Pushing emplois chunk ' + (i/CHUNK_SIZE + 1));
    const res = await fetch('https://atlasconcours.vercel.app/api/admin/push-scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ emplois: chunk, allowEmpty: true }),
    });
    if (!res.ok) console.log(await res.text());
  }

  console.log('Sending ' + concours.length + ' concours in chunks...');
  for (let i = 0; i < concours.length; i += CHUNK_SIZE) {
    const chunk = concours.slice(i, i + CHUNK_SIZE);
    console.log('Pushing concours chunk ' + (i/CHUNK_SIZE + 1));
    const res = await fetch('https://atlasconcours.vercel.app/api/admin/push-scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ concours: chunk, allowEmpty: true }),
    });
    if (!res.ok) console.log(await res.text());
  }

  console.log('Sync complete!');
  process.exit(0);
}

sync().catch(console.error);

