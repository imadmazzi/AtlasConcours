const fetch = require('node-fetch');
const db = require('./server/db');

async function upload() {
  await db.init();
  await db.syncFromAtlas(); // make sure we have the latest local data
  
  console.log(`Uploading ${db.data.emplois.length} emplois and ${db.data.concours.length} concours to Vercel...`);
  
  const res = await fetch('https://atlasconcours.vercel.app/api/debug/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(db.data)
  });
  
  const text = await res.text();
  console.log('Response:', text);
}

upload().catch(console.error);
