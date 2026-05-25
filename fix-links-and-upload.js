require('dotenv').config();
const db = require('./server/db');

async function fix() {
  await db.init();
  await db.syncFromAtlas(); // make sure we have the latest local data
  
  let updated = 0;
  for (const emploi of db.data.emplois) {
    if (emploi.lien_candidature && emploi.lien_candidature.includes('anapec.org') && emploi.lien_candidature.includes('detail_offre')) {
      const match = emploi.lien_candidature.match(/\/(\d{5,})/);
      if (match) {
        emploi.lien_candidature = `https://www.anapec.org/sigec-app-rv/fr/entreprises/bloc_offre_home/${match[1]}/resultat_recherche`;
        updated++;
      }
    }
  }
  
  if (updated > 0) {
    await db.save();
    console.log(`Updated ${updated} ANAPEC links in local DB.`);
    
    console.log('Uploading fixed data to Vercel...');
    const fetch = require('node-fetch');
    const res = await fetch('https://atlasconcours.vercel.app/api/debug/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(db.data)
    });
    console.log('Vercel Response:', await res.text());
  } else {
    console.log('No ANAPEC links needed fixing.');
  }
}

fix().catch(console.error);
