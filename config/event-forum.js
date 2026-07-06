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

async function handleEventInterestAdd(event, user) {
  const forumChannelId = SERVER_FORUM_MAP[event.guildId];
  if (!forumChannelId) return;

  // Partials may be missing data — fetch the full event
  const fullEvent = event.partial ? await event.fetch() : event;

  const record = await getThreadRecord(fullEvent.id);

  let thread;
  if (!record) {
    const forumChannel = await fullEvent.guild.channels.fetch(forumChannelId);
    thread = await forumChannel.threads.create({
      name: fullEvent.name,
      message: { content: fullEvent.url },
    });
    await saveThreadRecord(fullEvent.guildId, fullEvent.id, thread.id);
  } else {
    thread = await fullEvent.guild.channels.fetch(record.threadId);
  }

  // Sync all current subscribers — heals gaps from bot downtime
  const [threadMembers, subscribers] = await Promise.all([
    thread.members.fetch(),
    fullEvent.fetchSubscribers(),
  ]);

  const threadMemberIds = new Set(threadMembers.keys());
  await Promise.all(
    [...subscribers.keys()]
      .filter(userId => !threadMemberIds.has(userId))
      .map(userId => thread.members.add(userId))
  );
}

module.exports = { handleEventInterestAdd };
