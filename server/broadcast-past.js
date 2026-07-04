require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('./db');
const { broadcastConcours, broadcastEmploi } = require('./services/telegramService');

async function broadcastPastOffers() {
  await db.init();
  
  // Default to 5 offers, or read from command line args: node broadcast-past.js 10
  const limit = parseInt(process.argv[2], 10) || 5;

  console.log(`🚀 Attempting to broadcast the ${limit} most recent offers...`);

  // Grab the latest entries by reversing the arrays
  const recentConcours = [...(db.data.concours || [])].reverse().slice(0, limit);
  const recentEmplois = [...(db.data.emplois || [])].reverse().slice(0, limit);

  let successCount = 0;
  let failCount = 0;

  console.log(`\n--- Broadcasting Concours (${recentConcours.length}) ---`);
  for (const c of recentConcours) {
    try {
      console.log(`\n▶ Broadcasting: ${c.titre.substring(0, 60)}...`);
      await broadcastConcours(c);
      successCount++;
    } catch (err) {
      console.error(`❌ Skipped: ${err.message}`);
      failCount++;
    }
  }

  console.log(`\n--- Broadcasting Emplois (${recentEmplois.length}) ---`);
  for (const e of recentEmplois) {
    try {
      console.log(`\n▶ Broadcasting: ${e.titre.substring(0, 60)}...`);
      await broadcastEmploi(e);
      successCount++;
    } catch (err) {
      console.error(`❌ Skipped: ${err.message}`);
      failCount++;
    }
  }

  console.log(`\n✅ Broadcast complete! Successfully sent: ${successCount}. Skipped/Failed: ${failCount}.`);
  process.exit(0);
}

broadcastPastOffers().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
