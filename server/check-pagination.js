require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const https = require('https');
const cheerio = require('cheerio');
const axios = require('axios');
const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const ua = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

async function checkPagination() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🔍  PAGINATION & DATA VOLUME ANALYSIS');
  console.log('═══════════════════════════════════════════════════');

  // ── 1. Emploi-Public Concours ──────────────────────────────
  console.log('\n📋 EMPLOI-PUBLIC — CONCOURS');
  try {
    // Check multiple pages
    for (let page = 1; page <= 5; page++) {
      const url = `https://www.emploi-public.ma/fr/concours-liste?page=${page}`;
      const res = await axios.get(url, { httpsAgent, headers: ua, timeout: 20000, validateStatus: () => true });
      const ch = cheerio.load(res.data);
      const cards = ch('a.card.card-scale').length;
      console.log(`  Page ${page}: ${cards} cards found ${cards === 0 ? '(empty — end of listing)' : ''}`);
      if (cards === 0) break;
    }
    // Check pagination structure
    const res = await axios.get('https://www.emploi-public.ma/fr/concours-liste', { httpsAgent, headers: ua, timeout: 20000 });
    const ch = cheerio.load(res.data);
    const pagLinks = ch('.pagination a, .page-link, a[href*="page="]');
    console.log(`  Pagination links on page: ${pagLinks.length}`);
    pagLinks.each((i, el) => {
      const href = ch(el).attr('href') || '';
      const text = ch(el).text().trim();
      if (text && href) console.log(`    [${text}] → ${href}`);
    });
  } catch (err) {
    console.error('  ERROR:', err.message);
  }

  // ── 2. Emploi-Public Jobs ──────────────────────────────────
  console.log('\n💼 EMPLOI-PUBLIC — JOBS (emploi-sup)');
  try {
    for (let page = 1; page <= 5; page++) {
      const url = `https://www.emploi-public.ma/fr/emploi-sup-liste?page=${page}`;
      const res = await axios.get(url, { httpsAgent, headers: ua, timeout: 20000, validateStatus: () => true });
      const ch = cheerio.load(res.data);
      const cards = ch('a.card.card-scale').length;
      console.log(`  Page ${page}: ${cards} cards found ${cards === 0 ? '(empty — end of listing)' : ''}`);
      if (cards === 0) break;
    }
  } catch (err) {
    console.error('  ERROR:', err.message);
  }

  // ── 3. ANAPEC ─────────────────────────────────────────────
  console.log('\n🏢 ANAPEC');
  try {
    const res = await axios.get('https://www.anapec.org/sigec-app-rv/fr/chercheurs/resultat_recherche/tout:all', {
      httpsAgent, headers: ua, timeout: 20000
    });
    const ch = cheerio.load(res.data);
    const rows = ch('table tr').slice(1);
    const nyro = ch('a.nyroModal');
    console.log(`  Table rows: ${rows.length}`);
    console.log(`  nyroModal links: ${nyro.length}`);

    // Check pagination
    const pag = ch('.pagination a, .pager a, a[href*="page"]');
    console.log(`  Pagination links: ${pag.length}`);
    pag.each((i, el) => {
      const href = ch(el).attr('href') || '';
      const text = ch(el).text().trim();
      if (text && href) console.log(`    [${text}] → ${href.slice(0, 80)}`);
    });

    // Check total count text
    const bodyText = ch('body').text();
    const totalMatch = bodyText.match(/(\d+)\s*(offre|résultat|emploi|poste|total)/i);
    if (totalMatch) console.log(`  Total mentioned on page: "${totalMatch[0]}"`);
  } catch (err) {
    console.error('  ERROR:', err.message);
  }

  // ── 4. Scraper Config Analysis ────────────────────────────
  console.log('\n⚙️  SCRAPER CONFIGURATION');
  const scraper = require('fs').readFileSync(require('path').join(__dirname, 'scraper.js'), 'utf8');
  const limitMatch = scraper.match(/ITEM_LIMIT\s*=\s*IS_VERCEL\s*\?\s*(\d+)\s*:\s*(\d+)/);
  if (limitMatch) {
    console.log(`  ITEM_LIMIT: Vercel=${limitMatch[1]}, Local=${limitMatch[2]}`);
  }
  
  // ── 5. push-local-scrape analysis ─────────────────────────
  console.log('\n⚠️  PUSH-LOCAL-SCRAPE BEHAVIOR');
  const pushScript = require('fs').readFileSync(require('path').join(__dirname, 'push-local-scrape.js'), 'utf8');
  if (pushScript.includes('db.data.emplois = []')) {
    console.log('  🔴 DESTRUCTIVE: push-local-scrape.js WIPES all emplois before scraping!');
    console.log('     → db.data.emplois = []');
    console.log('     → This means every push REPLACES the entire database.');
    console.log('     → Only the latest scrape batch survives (max ITEM_LIMIT per source).');
  }
  if (pushScript.includes('db.data.concours = []')) {
    console.log('  🔴 DESTRUCTIVE: push-local-scrape.js WIPES all concours before scraping!');
  }

  // ── 6. Cron scraper analysis ──────────────────────────────
  console.log('\n📊 CRON SCRAPER BEHAVIOR (Vercel)');
  if (scraper.includes('existingLinks')) {
    console.log('  ✅ Cron scraper uses dedup (existingLinks Set) — ACCUMULATIVE');
    console.log('     → Vercel cron adds NEW items without wiping old ones');
    console.log('     → But ITEM_LIMIT on Vercel = 3 per source per run');
    console.log('     → So it adds at most 3 new items per hour');
  }

  // ── Summary ───────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════');
  console.log('📊 ROOT CAUSE SUMMARY');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log('  Problem: Only ~15 emplois + ~13 concours in the database.');
  console.log('');
  console.log('  Cause 1: push-local-scrape.js WIPES the entire DB before');
  console.log('           scraping, so only the latest batch exists.');
  console.log('');
  console.log('  Cause 2: ITEM_LIMIT = 15 (local) / 3 (Vercel) caps how');
  console.log('           many items are scraped per run.');
  console.log('');
  console.log('  Cause 3: The scraper only reads PAGE 1 of each source.');
  console.log('           No pagination logic exists.');
  console.log('');
  console.log('  Fix needed:');
  console.log('    1. Add pagination to scrape ALL pages');
  console.log('    2. Make push-local-scrape.js MERGE instead of WIPE');
  console.log('    3. Increase ITEM_LIMIT for local runs');
  console.log('═══════════════════════════════════════════════════');
}

checkPagination().catch(err => { console.error('Fatal:', err); process.exit(1); });
