require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const axios = require('axios');
const db = require('./db');
const { broadcastConcours, broadcastEmploi } = require('./services/telegramService');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const API_BASE = process.env.FORCE_FULL_SYNC_API_BASE || 'https://atlasconcours.vercel.app/api';
const SYNC_SOURCE = process.env.FORCE_FULL_SYNC_SOURCE || 'live-api';
const SYNC_LIMIT = Number(process.env.FORCE_FULL_SYNC_LIMIT) || 500;

function getTitle(item) {
  return item?.titre || item?.title || '';
}

function getIdentifier(type, item) {
  return type === 'concours'
    ? (item?.slug || item?._id || item?.id)
    : (item?._id || item?.id);
}

function assertOwnedDocument(type, item, sourceArray) {
  const title = getTitle(item);
  const identifier = getIdentifier(type, item);

  if (!title || !identifier) {
    throw new Error(`[TELEGRAM ABORT] ${type} item is missing title or identifier before broadcast.`);
  }

  const matches = sourceArray.filter(candidate => String(getIdentifier(type, candidate)) === String(identifier));
  if (matches.length !== 1) {
    throw new Error(`[TELEGRAM ABORT] ${type} identifier "${identifier}" matched ${matches.length} source documents; refusing to broadcast.`);
  }

  const matched = matches[0];
  if (matched !== item || getTitle(matched) !== title) {
    throw new Error(`[TELEGRAM ABORT] ${type} scope mismatch for "${identifier}". The title and identifier do not belong to the same object reference.`);
  }

  console.log(`[TELEGRAM LOCAL VERIFIED] Source object validated: "${title}" owns URL parameter: "${identifier}"`);
}

function assertNoDuplicateIdentifiers(type, rows) {
  const seen = new Set();
  for (const item of rows) {
    const identifier = String(getIdentifier(type, item) || '');
    if (!identifier) {
      throw new Error(`[TELEGRAM ABORT] ${type} item has no identifier.`);
    }
    if (seen.has(identifier)) {
      throw new Error(`[TELEGRAM ABORT] Duplicate ${type} identifier "${identifier}" found before sync.`);
    }
    seen.add(identifier);
  }
}

async function fetchLiveRows(path) {
  const url = `${API_BASE}/${path}?limit=${SYNC_LIMIT}&_cb=${Date.now()}`;
  const res = await axios.get(url, { timeout: 15000 });
  return Array.isArray(res.data?.data) ? res.data.data : [];
}

async function loadSyncRows() {
  if (SYNC_SOURCE === 'local-db') {
    await db.init();
    if (!db.data || (!db.data.concours && !db.data.emplois)) {
      throw new Error('Database data is not loaded properly.');
    }
    return {
      concours: db.data.concours || [],
      emplois: db.data.emplois || [],
    };
  }

  console.log(`Loading sync source from live API: ${API_BASE}`);
  return {
    concours: await fetchLiveRows('concours'),
    emplois: await fetchLiveRows('emplois'),
  };
}

async function forceFullSync() {
  console.log('Starting Force Full Sync to Telegram...');

  const { concours: allConcours, emplois: allEmplois } = await loadSyncRows();
  assertNoDuplicateIdentifiers('concours', allConcours);
  assertNoDuplicateIdentifiers('emplois', allEmplois);

  const total = allConcours.length + allEmplois.length;
  console.log(`Found ${total} total offers in ${SYNC_SOURCE} (${allConcours.length} concours, ${allEmplois.length} emplois).`);

  if (total === 0) {
    console.log('No offers found to sync.');
    return;
  }

  let current = 0;

  console.log('\nSyncing Concours...');
  for (const concours of allConcours) {
    current++;
    assertOwnedDocument('concours', concours, allConcours);
    console.log(`[${current}/${total}] Broadcasting concours: ${getTitle(concours)}...`);
    await broadcastConcours(concours);
    await delay(3500);
  }

  console.log('\nSyncing Emplois...');
  for (const emploi of allEmplois) {
    current++;
    assertOwnedDocument('emplois', emploi, allEmplois);
    console.log(`[${current}/${total}] Broadcasting emploi: ${getTitle(emploi)}...`);
    await broadcastEmploi(emploi);
    await delay(3500);
  }

  console.log('\nForce Full Sync Completed!');
}

forceFullSync().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
