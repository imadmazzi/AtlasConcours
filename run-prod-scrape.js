require('dotenv').config();
const db = require('./server/db');
const { runAnapecScraper, runJobScraper, runScraper } = require('./server/scraper');

async function runProductionScraper() {
  console.log('\n======================================================');
  console.log('⚡ [Production Scraper Runner] Starting real database population...');
  console.log('======================================================\n');

  // Verify we are pointing to MongoDB Atlas
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ Error: MONGODB_URI is not set in your local .env file.');
    console.error('💡 Please add your production MongoDB Atlas connection string to .env:');
    console.error('   MONGODB_URI="mongodb+srv://username:password@cluster..."');
    console.log('\n======================================================\n');
    process.exit(1);
  }

  // Temporarily override VERCEL detection so the local scraper runs with standard (non-Vercel) limits
  // meaning it will parse up to 15 real items per source instead of the 3-item Vercel ceiling.
  process.env.VERCEL = '';

  console.log('🔌 Connecting to MongoDB Atlas...');
  try {
    await db.init();
    if (db.storageMode !== 'mongodb') {
      throw new Error(`Failed to establish MongoDB connection. Active storage mode: ${db.storageMode}`);
    }
    console.log('✅ Connected successfully to production MongoDB Atlas!\n');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }

  // Capture database counts before the run
  const beforeConcours = db.prepare("SELECT COUNT(*) as count FROM concours").get()?.count || 0;
  const beforeJobs = db.prepare("SELECT COUNT(*) as count FROM emplois").get()?.count || 0;

  console.log('📊 Current Production Stats:');
  console.log(`   - Concours: ${beforeConcours}`);
  console.log(`   - Emplois:  ${beforeJobs}\n`);

  console.log('🚀 Triggering scrapers sequentially...');
  try {
    // Run all scrapers with force=false to respect duplicate checks and keep database clean,
    // but force=true can be passed if they want to force write test items.
    const force = process.argv.includes('--force');
    if (force) {
      console.log('⚠️  [Force mode active] Duplicate checks will be bypassed.');
    }

    console.log('\n--- 1/3 Scrapes: ANAPEC Jobs ---');
    const anapecStats = await runAnapecScraper(force);
    console.log(`   Result: ${anapecStats?.added || 0} added, ${anapecStats?.errors || 0} errors.`);

    console.log('\n--- 2/3 Scrapes: Emploi-Public Jobs ---');
    const jobsStats = await runJobScraper(force);
    console.log(`   Result: ${jobsStats?.added || 0} added, ${jobsStats?.errors || 0} errors.`);

    console.log('\n--- 3/3 Scrapes: Emploi-Public Concours ---');
    const concoursStats = await runScraper(force);
    console.log(`   Result: ${concoursStats?.added || 0} added, ${concoursStats?.errors || 0} errors.`);

  } catch (err) {
    console.error('\n❌ Scraper error occurred:', err.message);
  }

  // Refresh counts
  const afterConcours = db.prepare("SELECT COUNT(*) as count FROM concours").get()?.count || 0;
  const afterJobs = db.prepare("SELECT COUNT(*) as count FROM emplois").get()?.count || 0;

  console.log('\n======================================================');
  console.log('📋 FINAL PRODUCTION SCRAPE REPORT');
  console.log('======================================================');
  console.log(`   Concours: ${beforeConcours} ➔ ${afterConcours} (+${afterConcours - beforeConcours} new)`);
  console.log(`   Emplois:  ${beforeJobs} ➔ ${afterJobs} (+${afterJobs - beforeJobs} new)`);
  console.log('======================================================\n');
  
  process.exit(0);
}

runProductionScraper();
