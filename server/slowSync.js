require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./db');
const { broadcastConcours, broadcastEmploi } = require('./services/telegramService');

async function slowSync() {
  console.log("🚀 Starting Slow Sync to Telegram...");

  await db.init();

  const concoursList = db.data.concours || [];
  const emploisList = db.data.emplois || [];

  console.log(`Found ${concoursList.length + emploisList.length} total offers in database.`);

  console.log("\n📢 Syncing Concours...");
  for (let i = 0; i < concoursList.length; i++) {
    const item = concoursList[i];
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
    console.log(`[${i + 1}/${emploisList.length}] Broadcasting emploi: ${item.titre}...`);
    try {
      await broadcastEmploi(item);
    } catch (err) {
      console.error(`Failed to broadcast emploi: ${err.message}`);
    }
  }

  console.log("\n✅ Slow Sync Completed!");
}

slowSync().catch(console.error);
