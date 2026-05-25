require('dotenv').config();
const db = require('./server/db');
const cheerio = require('cheerio');

async function main() {
  await db.init();
  await db.syncFromAtlas();
  
  // Find a concours with a description
  const concoursWithDesc = db.data.concours.filter(c => c.description && c.description.includes('href'));
  console.log(`Found ${concoursWithDesc.length} concours with links.`);
  
  for (let i = 0; i < Math.min(5, concoursWithDesc.length); i++) {
    const c = concoursWithDesc[i];
    const $ = cheerio.load(c.description);
    const pdfLinks = [];
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && (href.toLowerCase().includes('.pdf') || href.toLowerCase().includes('fichier='))) {
        pdfLinks.push(href);
      }
    });
    console.log(`\nConcours: ${c.titre}`);
    console.log(`Lien Source: ${c.lien_source}`);
    console.log('PDF links found in description:', pdfLinks);
  }
  process.exit(0);
}
main().catch(console.error);
