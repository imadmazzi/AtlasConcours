require('dotenv').config();
const dns = require('dns');
const https = require('https');

function dohLookup(provider, name, type) {
  const url = `${provider}?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`;

  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { accept: 'application/dns-json' },
      timeout: 8000,
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`DNS-over-HTTPS ${type} lookup failed with HTTP ${res.statusCode}`));
          return;
        }

        try {
          const parsed = JSON.parse(body);
          resolve(parsed.Answer || []);
        } catch (err) {
          reject(new Error(`DNS-over-HTTPS ${type} response was not valid JSON: ${err.message}`));
        }
      });
    });

    req.on('timeout', () => req.destroy(new Error(`DNS-over-HTTPS ${type} lookup timed out`)));
    req.on('error', reject);
  });
}

async function lookupWithDoh(name, type) {
  const providers = [
    'https://cloudflare-dns.com/dns-query',
    'https://dns.google/resolve',
  ];

  let lastError;
  for (const provider of providers) {
    try {
      return await dohLookup(provider, name, type);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error(`DNS-over-HTTPS ${type} lookup failed`);
}

function parseTxtOptions(answer) {
  return (answer.data || '')
    .replace(/^"|"$/g, '')
    .replace(/"\s+"/g, '')
    .trim();
}

async function expandMongoSrvUri(uri) {
  const parsed = new URL(uri);
  const hostname = parsed.hostname;
  const srvName = `_mongodb._tcp.${hostname}`;
  const srvAnswers = await lookupWithDoh(srvName, 'SRV');
  const hosts = srvAnswers
    .map(answer => String(answer.data || '').trim().split(/\s+/))
    .filter(parts => parts.length >= 4)
    .map(parts => `${parts[3].replace(/\.$/, '')}:${parts[2]}`);

  if (hosts.length === 0) {
    throw new Error(`No SRV records found for ${srvName}`);
  }

  const params = new URLSearchParams(parsed.searchParams);

  try {
    const txtAnswers = await lookupWithDoh(hostname, 'TXT');
    for (const answer of txtAnswers) {
      const txtParams = new URLSearchParams(parseTxtOptions(answer));
      for (const [key, value] of txtParams.entries()) {
        if (!params.has(key)) params.set(key, value);
      }
    }
  } catch (err) {
    console.warn(`MongoDB TXT lookup skipped: ${err.message}`);
  }

  if (!params.has('tls') && !params.has('ssl')) {
    params.set('tls', 'true');
  }

  const auth = parsed.username
    ? `${parsed.username}${parsed.password ? `:${parsed.password}` : ''}@`
    : '';
  const path = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '';
  const query = params.toString();

  return `mongodb://${auth}${hosts.join(',')}${path}${query ? `?${query}` : ''}`;
}

async function configureMongoConnection() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return;

  const sanitizedUri = uri.trim().replace(/^["']|["']$/g, '').replace(/[\r\n]+/g, '');
  if (sanitizedUri !== uri) {
    process.env.MONGODB_URI = sanitizedUri;
  }

  if (!sanitizedUri.startsWith('mongodb+srv://')) return;

  const dnsServers = (process.env.MONGODB_DNS_SERVERS || '1.1.1.1,8.8.8.8')
    .split(',')
    .map(server => server.trim())
    .filter(Boolean);

  if (dnsServers.length > 0) {
    dns.setServers(dnsServers);
    console.log(`DNS resolvers for MongoDB SRV lookup: ${dnsServers.join(', ')}`);
  }

  if (process.env.MONGODB_EXPAND_SRV === 'false') return;

  try {
    process.env.MONGODB_URI = await expandMongoSrvUri(sanitizedUri);
    console.log('Expanded MongoDB SRV URI through DNS-over-HTTPS for reliable local connections.');
  } catch (err) {
    console.warn(`MongoDB SRV expansion skipped: ${err.message}`);
  }
}

async function runProductionScraper() {
  await configureMongoConnection();

  const db = require('./server/db');
  const { runAnapecScraper, runJobScraper, runScraper } = require('./server/scraper');

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
