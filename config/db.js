const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017';
const DB_NAME = 'datbotdoh';

let client;

async function connectDb() {
  client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection('packSessions');
  await col.createIndex({ messageId: 1 }, { unique: true });
  await col.createIndex({ postedAt: 1 });
  console.log('Connected to MongoDB');
}

function getCollection(name) {
  return client.db(DB_NAME).collection(name);
}

module.exports = { connectDb, getCollection };
