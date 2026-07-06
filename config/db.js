const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017';
const DB_NAME = 'datbotdoh';

let client;

async function connectDb() {
  if (client) return;
  const c = new MongoClient(uri);
  try {
    await c.connect();
  } catch (err) {
    await c.close().catch(() => {});
    throw err;
  }
  client = c;
  const col = client.db(DB_NAME).collection('packSessions');
  await col.createIndex({ messageId: 1 }, { unique: true });
  await col.createIndex({ postedAt: 1 });
  const eventThreadsCol = client.db(DB_NAME).collection('event_threads');
  await eventThreadsCol.createIndex({ eventId: 1 }, { unique: true });
  console.log('Connected to MongoDB');
}

function getCollection(name) {
  if (!client) throw new Error('DB not connected. Call connectDb() first.');
  return client.db(DB_NAME).collection(name);
}

module.exports = { connectDb, getCollection };
