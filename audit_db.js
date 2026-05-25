require('dotenv').config();
const { MongoClient } = require('mongodb');

async function auditDB() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('atlasconcours');
    
    console.log("=== ATLAS DB AUDIT START ===");
    
    const emplois = await db.collection('emplois').find({}).toArray();
    const concours = await db.collection('concours').find({}).toArray();
    
    console.log(`Total Emplois: ${emplois.length}`);
    console.log(`Total Concours: ${concours.length}`);

    let pollutedCount = 0;
    let totalLength = 0;

    const checkPollution = (items, type) => {
      items.forEach(item => {
        const desc = item.description || '';
        totalLength += desc.length;
        if (desc.includes('front_office.accessibilite') || 
            desc.includes('login') || 
            desc.includes('mot de passe') ||
            desc.includes('<header>') ||
            desc.includes('<nav>')) {
          console.log(`⚠️ Polluted [${type}]: ${item.title}`);
          pollutedCount++;
        }
      });
    };

    checkPollution(emplois, 'emploi');
    checkPollution(concours, 'concours');

    console.log(`\nPolluted Items Found: ${pollutedCount}`);
    console.log(`Average Description Length: ${totalLength / (emplois.length + concours.length)} chars (Should be < 5000)`);
    console.log("=== ATLAS DB AUDIT END ===");
  } finally {
    await client.close();
  }
}

auditDB().catch(console.error);
