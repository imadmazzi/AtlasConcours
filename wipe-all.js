require('dotenv').config();
const db = require('./server/db');

async function wipeAll() {
  await db.init();

  if (db.storageMode !== 'mongodb') {
    console.error('❌ Not connected to MongoDB! storageMode =', db.storageMode);
    process.exit(1);
  }

  console.log(`\n📊 Before: ${db.data.concours.length} concours, ${db.data.emplois.length} emplois`);
  
  db.data.concours = [];
  db.data.emplois  = [];

  await db.save();
  await db.flush();

  console.log('💾 Flushed clean data to MongoDB Atlas.');
  process.exit(0);
}

wipeAll().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
