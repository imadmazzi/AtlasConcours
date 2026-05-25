require('dotenv').config();
const db = require('./server/db');

async function main() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // For scraping gov sites

  console.log("🧹 1. Wiping local DB state...");
  await db.init();
  db.data.emplois = [];
  db.data.concours = [];
  await db.save();

  console.log("🌐 2. Running fresh scrape (force = true)...");
  // We can just run the scraper directly
  const scraper = require('./server/scraper');
  
  // Scrape Emplois
  const jobsRes = await scraper.runJobScraper(true);
  console.log("Jobs Scraped:", jobsRes);

  // Scrape Concours
  const concoursRes = await scraper.runScraper(true);
  console.log("Concours Scraped:", concoursRes);

  // Scrape ANAPEC
  const anapecRes = await scraper.runAnapecScraper(true);
  console.log("ANAPEC Scraped:", anapecRes);

  // Reload the db file since the scraper saves it
  await db.init();
  console.log(`\n📦 Local DB now has ${db.data.emplois.length} emplois and ${db.data.concours.length} concours.`);

  console.log("🚀 3. Uploading pristine data to Vercel/MongoDB Atlas (Overwriting existing)...");
  
  const uploadRes = await fetch('https://atlasconcours.vercel.app/api/debug/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(db.data)
  });
  
  const uploadResult = await uploadRes.text();
  console.log(`📡 Vercel response: ${uploadResult}`);

  // 4. Overwrite Atlas Directly just in case the API endpoint merges instead of wipes
  console.log("🗑️ 4. Wiping and syncing Atlas directly to be 100% certain...");
  const { MongoClient } = require('mongodb');
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const dbName = client.db('atlasconcours');
  
  await dbName.collection('emplois').deleteMany({});
  await dbName.collection('concours').deleteMany({});
  console.log("Atlas collections wiped.");

  if (db.data.emplois.length > 0) {
    await dbName.collection('emplois').insertMany(db.data.emplois);
  }
  if (db.data.concours.length > 0) {
    await dbName.collection('concours').insertMany(db.data.concours);
  }
  console.log("Atlas collections repopulated with pristine data.");
  await client.close();

  console.log("✅ Database Sanitization Complete!");
  process.exit(0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
