const fs = require('fs');
const cheerio = require('cheerio');

async function check() {
  const r = await fetch('https://atlasconcours.vercel.app/api/emplois');
  const res = await r.json();
  const job = res.data.find(j => j.description && j.description.includes('Contrat'));
  if (!job) return console.log('No job found');
  const $ = cheerio.load(job.description);
  console.log('Job:', job.titre);
  console.log($('body').text().replace(/\s+/g, ' ').substring(0, 1500));
}

check().catch(console.error);
