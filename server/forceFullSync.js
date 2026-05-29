require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./db');
const { broadcastConcours, broadcastEmploi } = require('./services/telegramService');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function forceFullSync() {
  console.log("🚀 Starting Force Full Sync to Telegram...");

  await db.init();

  if (!db.data || (!db.data.concours && !db.data.emplois)) {
    console.error("❌ Database data is not loaded properly.");
    return;
  }

  const allConcours = db.data.concours || [];
  const allEmplois = db.data.emplois || [];
  const total = allConcours.length + allEmplois.length;

  console.log(`Found ${total} total offers in database (${allConcours.length} concours, ${allEmplois.length} emplois).`);
  
  if (total === 0) {
    console.log("No offers found to sync.");
    return;
  }

  let current = 0;

  console.log(`\n📢 Syncing Concours...`);
  for (const concours of allConcours) {
    current++;
    console.log(`[${current}/${total}] Broadcasting concours: ${concours.titre || concours.title || 'Unknown Title'}...`);
    await broadcastConcours(concours);
    await delay(3500); // Strict 3.5-second delay to avoid rate limits
  }

  console.log(`\n💼 Syncing Emplois...`);
  for (const emploi of allEmplois) {
    current++;
    console.log(`[${current}/${total}] Broadcasting emploi: ${emploi.titre || emploi.title || 'Unknown Title'}...`);
    await broadcastEmploi(emploi);
    await delay(3500); // Strict 3.5-second delay
  }

  console.log("\n✅ Force Full Sync Completed!");
}

forceFullSync().catch(err => {
  console.error("Sync failed:", err);
});
