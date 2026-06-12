require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const db = require('../db');

const BAD_DATE_STRINGS = ['30 Mai 2026', '30 mai 2026'];
const DIRECT_COLLECTION_FIELDS = [
  'titre',
  'title',
  'date_limite',
  'deadline',
  'description',
  'contenu',
  'categorie',
  'category',
  'entreprise',
  'organisme',
  'localisation',
  'ville',
  'lien_source',
  'lien_candidature',
  'url',
];

function valueContainsBadDate(value) {
  if (value == null) return false;

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value);
    return BAD_DATE_STRINGS.some(badDate => text.includes(badDate));
  }

  if (Array.isArray(value)) {
    return value.some(valueContainsBadDate);
  }

  if (typeof value === 'object') {
    return Object.values(value).some(valueContainsBadDate);
  }

  return false;
}

function buildDirectDeleteFilter() {
  return {
    $or: DIRECT_COLLECTION_FIELDS.flatMap(field =>
      BAD_DATE_STRINGS.map(badDate => ({ [field]: { $regex: badDate } }))
    ),
  };
}

function removeBadRows(rows) {
  const kept = [];
  const removed = [];

  for (const row of rows || []) {
    if (valueContainsBadDate(row)) {
      removed.push(row);
    } else {
      kept.push(row);
    }
  }

  return { kept, removed };
}

async function deleteDirectCollectionMatches(collectionName) {
  const nativeDb = db.collection?.db || db.collection?.s?.db;
  if (!nativeDb) {
    return { collectionName, matched: 0, deleted: 0, skipped: 'Native MongoDB database handle unavailable.' };
  }

  const collection = nativeDb.collection(collectionName);
  const filter = buildDirectDeleteFilter();
  const matched = await collection.countDocuments(filter);
  const result = await collection.deleteMany(filter);

  return { collectionName, matched, deleted: result.deletedCount || 0 };
}

async function forceDeleteMay2026() {
  console.log('[forceDeleteMay2026] Connecting to production MongoDB Atlas...');
  await db.init();

  if (db.storageMode !== 'mongodb' || !db.collection) {
    throw new Error(`Refusing to run: expected MongoDB Atlas storage, got "${db.storageMode}".`);
  }

  await db.syncFromAtlas();

  const before = {
    concours: db.data.concours?.length || 0,
    emplois: db.data.emplois?.length || 0,
  };

  const concoursResult = removeBadRows(db.data.concours || []);
  const emploisResult = removeBadRows(db.data.emplois || []);

  db.data.concours = concoursResult.kept;
  db.data.emplois = emploisResult.kept;

  const embeddedDeleted = {
    concours: concoursResult.removed.length,
    emplois: emploisResult.removed.length,
  };

  console.log(`[forceDeleteMay2026] Embedded matches found: ${embeddedDeleted.concours} concours, ${embeddedDeleted.emplois} emplois.`);

  if (embeddedDeleted.concours > 0 || embeddedDeleted.emplois > 0) {
    await db.flush();
  }

  const directDeletes = [];
  for (const collectionName of ['concours', 'emplois']) {
    try {
      directDeletes.push(await deleteDirectCollectionMatches(collectionName));
    } catch (err) {
      directDeletes.push({ collectionName, matched: 0, deleted: 0, error: err.message });
    }
  }

  await db.syncFromAtlas();

  const remaining = {
    concours: (db.data.concours || []).filter(valueContainsBadDate).length,
    emplois: (db.data.emplois || []).filter(valueContainsBadDate).length,
  };

  const after = {
    concours: db.data.concours?.length || 0,
    emplois: db.data.emplois?.length || 0,
  };

  console.log('[forceDeleteMay2026] Cleanup report:');
  console.log(JSON.stringify({
    badDateStrings: BAD_DATE_STRINGS,
    before,
    embeddedDeleted,
    directDeletes,
    after,
    remaining,
  }, null, 2));

  if (remaining.concours !== 0 || remaining.emplois !== 0) {
    throw new Error(`Cleanup incomplete: ${remaining.concours} concours and ${remaining.emplois} emplois still contain the bad date.`);
  }
}

forceDeleteMay2026()
  .then(() => {
    console.log('[forceDeleteMay2026] Done.');
    process.exit(0);
  })
  .catch(err => {
    console.error('[forceDeleteMay2026] FAILED:', err.stack || err.message);
    process.exit(1);
  });
