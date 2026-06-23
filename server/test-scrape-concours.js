require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('./db');
const { runScraper, runJobScraper, runAnapecScraper } = require('./scraper');

async function testAll() {
  await db.init();
  console.log("Starting scrape tests...");
  
  // We'll run them to just grab the first few elements to see if the fields populate.
  console.log("--- Concours ---");
  await runScraper(true);
  
  console.log("--- Emplois ---");
  await runJobScraper(true);

  console.log("Done. Checking results:");
  const c = db.data.concours.slice(-1)[0];
  if(c) {
      console.log("Last Concours:");
      console.log(`Title: ${c.titre}\nPostes: ${c.postes}\nDeadline: ${c.date_limite}\nDiplome: ${c.diplome}\nTexte length: ${c.texte_complet?.length}`);
  }
  
  const e = db.data.emplois.slice(-1)[0];
  if(e) {
      console.log("Last Emploi:");
      console.log(`Title: ${e.titre}\nPostes: ${e.postes}\nDeadline: ${e.deadline}\nDiplome: ${e.diplome}\nTexte length: ${e.texte_complet?.length}`);
  }
  
  process.exit(0);
}

testAll();
