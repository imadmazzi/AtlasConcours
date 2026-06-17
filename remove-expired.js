require('dotenv').config();
const db = require('./server/db');
const { isExpired } = require('./server/utils/dateParser');

async function removeExpired() {
  await db.init();
  
  const beforeEmplois = db.data.emplois.length;
  const beforeConcours = db.data.concours.length;
  
  db.data.emplois = db.data.emplois.filter(e => {
    const deadline = e.date_limite || e.deadline;
    const isExplicitlyExpired = e.titre && (e.titre.toLowerCase().includes('expiré') || e.titre.toLowerCase().includes('[expiré]'));
    return !isExplicitlyExpired && !isExpired(deadline);
  });
  
  db.data.concours = db.data.concours.filter(c => {
    const deadline = c.date_limite || c.deadline;
    const isExplicitlyExpired = c.titre && (c.titre.toLowerCase().includes('expiré') || c.titre.toLowerCase().includes('[expiré]'));
    return !isExplicitlyExpired && !isExpired(deadline);
  });
  
  const removedEmplois = beforeEmplois - db.data.emplois.length;
  const removedConcours = beforeConcours - db.data.concours.length;
  
  console.log(`Removed ${removedEmplois} expired emplois.`);
  console.log(`Removed ${removedConcours} expired concours.`);
  
  if (removedEmplois > 0 || removedConcours > 0) {
    await db.save();
    await db.flush();
    console.log("Database updated successfully.");
  } else {
    console.log("No expired items found.");
  }
  
  process.exit(0);
}

removeExpired().catch(err => {
  console.error(err);
  process.exit(1);
});
