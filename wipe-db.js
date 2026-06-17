require('dotenv').config();
const db = require('./server/db');

async function wipeDatabase() {
  await db.init();
  
  const beforeEmplois = db.data.emplois.length;
  const beforeConcours = db.data.concours.length;
  
  db.data.emplois = [];
  db.data.concours = [];
  
  await db.save();
  await db.flush();
  
  console.log(`Wiped ${beforeEmplois} emplois and ${beforeConcours} concours.`);
  console.log("Database is now a 100% clean slate.");
  
  process.exit(0);
}

wipeDatabase().catch(err => {
  console.error("Error wiping database:", err);
  process.exit(1);
});
