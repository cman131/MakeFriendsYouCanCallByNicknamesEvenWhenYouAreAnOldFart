const { GuildScheduledEventStatus } = require('discord.js');
const { getCollection } = require('./db');

const SERVER_FORUM_MAP = {
  '1015706233061245099': '1522711422637703268',
};

function col() {
  return getCollection('event_threads');
}

async function getThreadRecord(eventId) {
  return col().findOne({ eventId });
}

async function saveThreadRecord(guildId, eventId, threadId) {
  await col().insertOne({ guildId, eventId, threadId });
}

async function deleteThreadRecord(eventId) {
  await col().deleteOne({ eventId });
}

module.exports = {};
