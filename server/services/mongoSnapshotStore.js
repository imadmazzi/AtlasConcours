const { BSON } = require('mongodb');
const { Readable, Writable } = require('stream');
const { pipeline } = require('stream/promises');
const { createGzip, createGunzip } = require('zlib');

// Leave room for MongoDB's update-command envelope below the 16 MiB limit.
const INLINE_LIMIT = 8 * 1024 * 1024;
const SNAPSHOT_NAME = 'main_db.json.gz';

class MongoSnapshotStore {
  constructor(collection, bucket) {
    this.collection = collection;
    this.bucket = bucket;
  }

  async read() {
    const doc = await this.collection.findOne({ _id: 'main_db' });
    if (!doc) return null;
    if (!doc.snapshotId) {
      if (!doc.data) throw new Error('MongoDB store is missing its data');
      return doc.data;
    }
    if (doc.snapshotEncoding !== 'gzip-json-v1') {
      throw new Error('Unsupported MongoDB snapshot encoding');
    }

    const chunks = [];
    await pipeline(
      this.bucket.openDownloadStream(doc.snapshotId),
      createGunzip(),
      new Writable({ write(chunk, encoding, callback) { chunks.push(chunk); callback(); } })
    );
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }

  async write(data) {
    // Freeze the snapshot before the first await; callers continue editing RAM.
    const json = JSON.stringify(data);
    const snapshot = JSON.parse(json);
    if (BSON.calculateObjectSize({ _id: 'main_db', data: snapshot }) <= INLINE_LIMIT) {
      await this.collection.updateOne(
        { _id: 'main_db' },
        { $set: { data: snapshot }, $unset: { snapshotId: '', snapshotEncoding: '' } },
        { upsert: true }
      );
    } else {
      const upload = this.bucket.openUploadStream(SNAPSHOT_NAME);
      await pipeline(Readable.from([Buffer.from(json)]), createGzip(), upload);
      // Publish only a fully uploaded snapshot. Existing readers keep using the
      // previous snapshot until this single-document update succeeds.
      await this.collection.updateOne(
        { _id: 'main_db' },
        {
          $set: { snapshotId: upload.id, snapshotEncoding: 'gzip-json-v1' },
          $unset: { data: '' },
        },
        { upsert: true }
      );
    }

    // Keep a grace period for in-flight readers; also collect uploads orphaned
    // by an interrupted write. Never delete the currently published snapshot.
    await this.cleanup().catch(err => console.warn('Snapshot cleanup deferred:', err.message));
  }

  async cleanup() {
    const current = await this.collection.findOne({ _id: 'main_db' });
    const stale = this.bucket.find({
      filename: SNAPSHOT_NAME,
      uploadDate: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      _id: { $ne: current?.snapshotId || null },
    }).limit(10);
    for await (const file of stale) await this.bucket.delete(file._id);
  }
}

module.exports = { MongoSnapshotStore };
