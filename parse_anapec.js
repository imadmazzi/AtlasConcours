const cheerio = require('cheerio');
const fs = require('fs');

async function check() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED='0';
  const r = await fetch('https://www.anapec.org/sigec-app-rv/fr/entreprises/bloc_offre_home/1124757/resultat_recherche');
  const t = await r.text();
  const $ = cheerio.load(t);
  
  console.log('Title:', $('title').text());
  console.log('H1:', $('h1').text());
  console.log('Main Content:', $('body').text().replace(/\s+/g, ' ').substring(0, 500));
}

check();
