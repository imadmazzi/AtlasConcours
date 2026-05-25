require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const axios = require('axios');
const { broadcastConcours, broadcastEmploi } = require('./services/telegramService');

async function syncCorrectLinks() {
  console.log("🚀 Starting Correct Links Sync via Vercel Live API...");

  try {
    console.log("📥 Fetching Concours from live Vercel API...");
    const concoursRes = await axios.get('https://atlasconcours.vercel.app/api/concours?limit=200');
    const concoursList = Array.isArray(concoursRes.data) ? concoursRes.data : (concoursRes.data.data || []);
    console.log(`Found ${concoursList.length} concours.`);

    console.log("\n📢 Syncing Concours...");
    for (let i = 0; i < concoursList.length; i++) {
      const item = concoursList[i];
      if (!item.slug && !item.id) {
        console.log(`[${i + 1}/${concoursList.length}] ⚠️ Skipping concours: ${item.titre} (No identifier)`);
        continue;
      }
      console.log(`[${i + 1}/${concoursList.length}] Broadcasting concours: ${item.titre}...`);
      try {
        await broadcastConcours(item);
      } catch (err) {
        console.error(`Failed to broadcast concours: ${err.message}`);
      }
    }

    console.log("\n📥 Fetching Emplois from live Vercel API...");
    const emploisRes = await axios.get('https://atlasconcours.vercel.app/api/emplois?limit=200');
    const emploisList = Array.isArray(emploisRes.data) ? emploisRes.data : (emploisRes.data.data || []);
    console.log(`Found ${emploisList.length} emplois.`);

    console.log("\n💼 Syncing Emplois...");
    for (let i = 0; i < emploisList.length; i++) {
      const item = emploisList[i];
      if (!item.id) {
        console.log(`[${i + 1}/${emploisList.length}] ⚠️ Skipping emploi: ${item.titre} (No id)`);
        continue;
      }
      console.log(`[${i + 1}/${emploisList.length}] Broadcasting emploi: ${item.titre}...`);
      try {
        await broadcastEmploi(item);
      } catch (err) {
        console.error(`Failed to broadcast emploi: ${err.message}`);
      }
    }

    console.log("\n✅ Correct Links Sync Completed via Live API!");
  } catch (err) {
    console.error("❌ Sync script encountered a fatal error:", err.message);
  }
}

syncCorrectLinks().catch(console.error);
