require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./db');
const { broadcastConcours, broadcastEmploi } = require('./services/telegramService');

async function syncCorrectLinks() {
  console.log("🚀 Starting Correct Links Sync to Telegram...");

  await db.init();
  await db.syncFromAtlas();

  const concoursList = db.data.concours || [];
  const emploisList = db.data.emplois || [];

  console.log(`Found ${concoursList.length + emploisList.length} total offers in database.`);

  console.log("\n📢 Syncing Concours with correct slug...");
  for (let i = 0; i < concoursList.length; i++) {
    const item = concoursList[i];
    if (!item.slug) {
      console.log(`[${i + 1}/${concoursList.length}] ⚠️ Skipping concours: ${item.titre} (No slug found)`);
      continue;
    }
    console.log(`[${i + 1}/${concoursList.length}] Broadcasting concours: ${item.titre}...`);
    try {
      await broadcastConcours(item);
    } catch (err) {
      console.error(`Failed to broadcast concours: ${err.message}`);
    }
  }

  console.log("\n💼 Syncing Emplois...");
  for (let i = 0; i < emploisList.length; i++) {
    const item = emploisList[i];
    if (!item.id) {
      console.log(`[${i + 1}/${emploisList.length}] ⚠️ Skipping emploi: ${item.titre} (No id found)`);
      continue;
    }
    console.log(`[${i + 1}/${emploisList.length}] Broadcasting emploi: ${item.titre}...`);
    try {
      await broadcastEmploi(item);
    } catch (err) {
      console.error(`Failed to broadcast emploi: ${err.message}`);
    }
  }

  console.log("\n✅ Correct Links Sync Completed!");
}

syncCorrectLinks().catch(console.error);
