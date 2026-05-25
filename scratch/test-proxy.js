const axios = require('axios');
const https = require('https');
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function testProxies() {
  const url = 'https://www.anapec.org/sigec-app-rv/fr/chercheurs/resultat_recherche/tout:all';
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.codetabs.com/cors-proxy/${url}`
  ];

  for (const proxy of proxies) {
    console.log(`\nTesting proxy: ${proxy}`);
    try {
      const res = await axios.get(proxy, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' }, httpsAgent });
      console.log(`✅ Success! Response status: ${res.status}, content length: ${res.data?.length || 0}`);
      if (res.data && res.data.includes('nyroModal')) {
        console.log('🎉 Found nyroModal! This proxy successfully retrieved ANAPEC job rows!');
        break;
      } else {
        console.log('⚠️ Retrieved page but did not find expected ANAPEC elements.');
      }
    } catch (err) {
      console.error(`❌ Failed: ${err.message}`);
    }
  }
}

testProxies();
