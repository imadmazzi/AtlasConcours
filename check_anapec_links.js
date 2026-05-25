const cheerio = require('cheerio');
const fs = require('fs');

async function check() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED='0';
  const r = await fetch('https://www.anapec.org/sigec-app-rv/fr/chercheurs/resultat_recherche/tout:all');
  const t = await r.text();
  const $ = cheerio.load(t);
  
  const links = [];
  $('a.nyroModal').slice(0, 5).each((i, el) => {
    links.push($(el).attr('href'));
    links.push($(el).attr('onclick'));
  });
  console.log('nyroModal links:', links);

  const tdLinks = [];
  $('td a').slice(0, 5).each((i, el) => {
    tdLinks.push($(el).attr('href'));
  });
  console.log('td links:', tdLinks);
}

check();
