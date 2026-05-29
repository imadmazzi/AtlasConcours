require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function testUrl(label, url, check) {
  console.log(`\n🔍 [${label}] Fetching: ${url}`);
  try {
    const res = await axios.get(url, {
      timeout: 20000,
      httpsAgent,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      maxRedirects: 5,
      validateStatus: () => true,
    });
    console.log(`   ✅ HTTP ${res.status} — Content-Length: ${String(res.data).length} bytes`);
    if (check) check(res);
  } catch (err) {
    console.error(`   ❌ FAILED: ${err.message}`);
  }
}

async function run() {
  console.log('====================================================');
  console.log('🩺  SCRAPER DIAGNOSTIC REPORT');
  console.log('====================================================');

  // ── 1. ANAPEC ───────────────────────────────────────────────
  await testUrl(
    'ANAPEC LIST',
    'https://www.anapec.org/sigec-app-rv/fr/chercheurs/resultat_recherche/tout:all',
    (res) => {
      const $ = cheerio.load(res.data);
      const rows = $('table tr').slice(1);
      const nyroLinks = [];
      rows.each((i, el) => {
        const a = $(el).find('a.nyroModal');
        if (a.length) nyroLinks.push(a.attr('href'));
      });
      console.log(`   📋 Table rows: ${rows.length}`);
      console.log(`   🔗 nyroModal links: ${nyroLinks.length}`);
      if (nyroLinks.length > 0) console.log(`   Sample link: ${nyroLinks[0]}`);
      else console.log('   ⚠️  No nyroModal links found — selector may be broken!');

      // Try alternate selectors
      const altRows = $('tr').length;
      const altCards = $('[class*="offre"]').length + $('[class*="job"]').length;
      console.log(`   Alt: <tr> count=${altRows}, offre/job class elements=${altCards}`);
    }
  );

  // ── 2. EMPLOI-PUBLIC Concours ────────────────────────────────
  await testUrl(
    'EMPLOI-PUBLIC CONCOURS',
    'https://www.emploi-public.ma/fr/concours-liste',
    (res) => {
      const $ = cheerio.load(res.data);
      const cards = $('a.card.card-scale');
      console.log(`   📋 a.card.card-scale found: ${cards.length}`);
      if (cards.length === 0) {
        // Try alternate selectors
        const altA = $('a[href*="/concours/"]').length;
        const altCard = $('[class*="card"]').length;
        console.log(`   Alt: links with /concours/ in href: ${altA}`);
        console.log(`   Alt: elements with "card" in class: ${altCard}`);
        // Print first 500 chars of body to see structure
        const bodyText = $('body').text().replace(/\s+/g, ' ').slice(0, 500);
        console.log(`   Body preview: ${bodyText}`);
      } else {
        const firstHref = $(cards[0]).attr('href') || '';
        console.log(`   ✅ First card href: ${firstHref}`);
      }
    }
  );

  // ── 3. EMPLOI-PUBLIC Jobs ────────────────────────────────────
  await testUrl(
    'EMPLOI-PUBLIC JOBS',
    'https://www.emploi-public.ma/fr/emploi-sup-liste',
    (res) => {
      const $ = cheerio.load(res.data);
      const cards = $('a.card.card-scale');
      console.log(`   📋 a.card.card-scale found: ${cards.length}`);
      if (cards.length === 0) {
        const altA = $('a[href*="/emploi-sup/"]').length;
        console.log(`   Alt: links with /emploi-sup/ in href: ${altA}`);
        const bodyText = $('body').text().replace(/\s+/g, ' ').slice(0, 500);
        console.log(`   Body preview: ${bodyText}`);
      } else {
        const firstHref = $(cards[0]).attr('href') || '';
        console.log(`   ✅ First card href: ${firstHref}`);
      }
    }
  );

  // ── 4. Check vercel.json cron config ─────────────────────────
  const fs = require('fs');
  const path = require('path');
  const vercelPath = path.join(__dirname, '../vercel.json');
  if (fs.existsSync(vercelPath)) {
    const vercelConfig = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
    console.log('\n⏰ [VERCEL CRON CONFIG]');
    console.log(JSON.stringify(vercelConfig.crons || vercelConfig.cron || 'No cron found', null, 2));
  } else {
    console.log('\n⚠️  vercel.json not found — Vercel cron not configured!');
  }

  console.log('\n====================================================');
  console.log('✅  Diagnostic complete.');
  console.log('====================================================\n');
}

run().catch(err => {
  console.error('Diagnostic failed:', err);
  process.exit(1);
});
