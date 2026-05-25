require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const axios = require('axios');
const { broadcastEmploi } = require('./services/telegramService');

async function testSingleRecord() {
  console.log("🚀 Starting Single Record Test from Vercel API (ID: 16)...");

  // Fetch the exact 'Directeur de l'Enseignement' object from Vercel where its ID is 16
  let testEmploi;
  try {
    const res = await axios.get('https://atlasconcours.vercel.app/api/emplois/16');
    testEmploi = res.data;
  } catch(e) {
    console.error("Could not fetch ID 16 from Vercel:", e.message);
    return;
  }

  console.log(`\n📢 Preparing to broadcast: "${testEmploi.titre}" (ID: ${testEmploi.id})`);
  
  try {
    await broadcastEmploi(testEmploi);
    console.log("\n✅ Test broadcast attempt finished. Please check the Telegram channel!");
  } catch (err) {
    console.error(`❌ Failed to broadcast: ${err.message}`);
  }
}

testSingleRecord().catch(console.error);
