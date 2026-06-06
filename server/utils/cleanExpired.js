require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const db = require('../db');
const { isExpired } = require('./dateParser');

async function clean() {
  console.log("🧹 Starting database cleanup for expired offers...");
  await db.init();
  
  if (!db.data) {
    console.error("❌ Database data not loaded.");
    return;
  }

  const beforeConcours = db.data.concours ? db.data.concours.length : 0;
  const beforeEmplois = db.data.emplois ? db.data.emplois.length : 0;

  db.data.concours = (db.data.concours || []).filter(c => !isExpired(c.date_limite));
  db.data.emplois = (db.data.emplois || []).filter(e => !isExpired(e.date_limite || e.deadline));

  const removedConcours = beforeConcours - db.data.concours.length;
  const removedEmplois = beforeEmplois - db.data.emplois.length;

  console.log(`✅ Cleaned up ${removedConcours} expired concours.`);
  console.log(`✅ Cleaned up ${removedEmplois} expired emplois.`);
  
  await db.save();
  await db.flush();
  
  console.log("💾 Database successfully saved and flushed to Atlas.");
}

clean().catch(err => {
  console.error("Cleanup failed:", err);
});
