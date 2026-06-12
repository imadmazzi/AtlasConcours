require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const db = require('../db');

async function forceDeleteMay() {
  console.log("🧹 Starting HARD DELETE for 'Mai' items...");
  await db.init();
  
  if (!db.data) {
    console.error("❌ Database data not loaded.");
    return;
  }

  const beforeConcours = db.data.concours ? db.data.concours.length : 0;
  const beforeEmplois = db.data.emplois ? db.data.emplois.length : 0;

  const hasMai = (str) => {
    if (!str) return false;
    return String(str).toLowerCase().includes('mai');
  };

  db.data.concours = (db.data.concours || []).filter(c => {
    return !hasMai(c.date_limite) && !hasMai(c.deadline) && !hasMai(c.titre) && !hasMai(c.description);
  });
  
  db.data.emplois = (db.data.emplois || []).filter(e => {
    return !hasMai(e.date_limite) && !hasMai(e.deadline) && !hasMai(e.titre) && !hasMai(e.description);
  });

  const removedConcours = beforeConcours - db.data.concours.length;
  const removedEmplois = beforeEmplois - db.data.emplois.length;

  console.log(`✅ Permanently deleted ${removedConcours} concours containing 'Mai'.`);
  console.log(`✅ Permanently deleted ${removedEmplois} emplois containing 'Mai'.`);
  
  await db.save();
  await db.flush();
  
  console.log("💾 Database successfully saved and flushed to Atlas.");
}

forceDeleteMay().catch(err => {
  console.error("Hard delete failed:", err);
});
