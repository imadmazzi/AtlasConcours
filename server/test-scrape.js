require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const db = require('./db');
const { runAnapecScraper } = require('./scraper');

async function testScrape() {
  console.log('\n========================================');
  console.log('🧪 [Test] Starting ANAPEC Scraper manually...');
  console.log('========================================\n');

  // Capture current state for comparison
  const beforeCount = db.data.emplois.length;
  console.log(`📊 [Test] Current emplois in db.json before scrape: ${beforeCount}`);
  console.log(`🔑 [Test] Gemini API Key configured: ${process.env.GEMINI_API_KEY ? '✅ YES' : '❌ NO (will use fallback mode)'}`);
  console.log('');

  // Patch processPipeline logs by monkey-patching console.log
  const originalLog = console.log;
  console.log = (...args) => {
    const msg = args.join(' ');
    // Tag scraper-specific logs
    if (msg.includes('Scraper') || msg.includes('Lot de') || msg.includes('Bilan') || msg.includes('Retrying')) {
      originalLog('[Test]', ...args);
    } else {
      originalLog(...args);
    }
  };

  try {
    await runAnapecScraper();
  } catch (err) {
    console.log = originalLog;
    console.error('❌ [Test] Scraper threw an uncaught error:', err.message);
    process.exit(1);
  }

  // Restore original console.log
  console.log = originalLog;

  // Post-run report
  const afterCount = db.data.emplois.length;
  const added = afterCount - beforeCount;

  console.log('\n========================================');
  console.log('📋 [Test] SCRAPE REPORT');
  console.log('========================================');
  console.log(`  Before: ${beforeCount} emplois`);
  console.log(`  After:  ${afterCount} emplois`);
  console.log(`  Added:  ${added} new jobs`);
  console.log('');

  if (added > 0) {
    console.log('✅ [Test] Successfully saved to db.json!');
    console.log('\n🆕 [Test] Newly added job titles:');
    db.data.emplois.slice(-added).forEach((job, i) => {
      console.log(`  ${i + 1}. [Test] Scraped job title: ${job.titre}`);
      console.log(`       Entreprise: ${job.entreprise || 'N/A'}`);
      console.log(`       Localisation: ${job.localisation || 'N/A'}`);
    });
  } else {
    console.log('ℹ️  [Test] No new jobs were added. Either all items were duplicates,');
    console.log('   the ANAPEC site was unreachable, or 0 new listings were found.');
  }

  console.log('\n========================================\n');
  process.exit(0);
}

testScrape();
