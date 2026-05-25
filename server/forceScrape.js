require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./db');
const { runScraper, runJobScraper, runAnapecScraper } = require('./scraper');

async function doFullScrape() {
  console.log("🚀 Forcing a full scrape cycle...");

  await db.init();

  console.log("\n--- Scraping Concours ---");
  await runScraper(true); 

  console.log("\n--- Scraping Emplois ---");
  await runJobScraper(true);

  console.log("\n--- Scraping ANAPEC ---");
  await runAnapecScraper(true);

  console.log("\n✅ Full scrape complete. Check db.json for the new items.");

  console.log("\n🚀 Triggering force full sync to Telegram...");
  const { spawn } = require('child_process');
  const sync = spawn('node', ['server/forceFullSync.js'], { stdio: 'inherit' });
  sync.on('close', (code) => {
    console.log(`Sync process exited with code ${code}`);
  });
}

doFullScrape().catch(console.error);
