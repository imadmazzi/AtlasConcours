require('dotenv').config();
const db = require('./server/db');

async function cleanup() {
  await db.init();
  
  if (db.storageMode !== 'mongodb') {
    console.warn("WARNING: Not connected to MongoDB. Using local storage.");
  }
  
  const beforeEmplois = db.data.emplois.length;
  const beforeConcours = db.data.concours.length;
  
  // Filter out failover jobs
  db.data.emplois = db.data.emplois.filter(e => !e.lien_candidature || !e.lien_candidature.includes('failover'));
  
  // Filter out failover concours
  db.data.concours = db.data.concours.filter(c => !c.lien_source || !c.lien_source.includes('failover'));
  
  const removedEmplois = beforeEmplois - db.data.emplois.length;
  const removedConcours = beforeConcours - db.data.concours.length;
  
  console.log(`Removed ${removedEmplois} failover emplois.`);
  console.log(`Removed ${removedConcours} failover concours.`);
  
  if (removedEmplois > 0 || removedConcours > 0) {
    await db.save();
    await db.flush();
    console.log("Database flushed.");
  } else {
    console.log("No failover jobs found. Exiting.");
  }
  
  process.exit(0);
}

cleanup().catch(err => {
  console.error("Error during cleanup:", err);
  process.exit(1);
});
