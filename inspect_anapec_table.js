const cheerio = require('cheerio');

async function check() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const r = await fetch('https://www.anapec.org/sigec-app-rv/fr/chercheurs/resultat_recherche/tout:all');
  const html = await r.text();
  const $ = cheerio.load(html);

  // Log first 5 rows to understand the table structure
  $('table tr').slice(1, 6).each((i, el) => {
    const tds = $(el).find('td');
    const linkEl = $(el).find('a.nyroModal');
    console.log(`--- Row ${i+1} ---`);
    tds.each((j, td) => {
      console.log(`  TD[${j}]: "${$(td).text().trim().replace(/\s+/g, ' ').substring(0, 80)}"`);
    });
    console.log(`  Link text: "${linkEl.text().trim().replace(/\s+/g, ' ')}"`);
    console.log(`  Link href: ${linkEl.attr('href')}`);
  });
}

check().catch(console.error);
