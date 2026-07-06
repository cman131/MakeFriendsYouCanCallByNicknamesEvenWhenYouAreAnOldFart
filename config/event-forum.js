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
  if (!forumChannelId) {
    console.log(`[event-forum] No forum channel mapped for guild ${event.guildId} — skipping interest add`);
    return;
  }

  // Partials may be missing data — fetch the full event
  const fullEvent = event.partial ? await event.fetch() : event;

  const record = await getThreadRecord(fullEvent.id);

  let thread;
  if (!record) {
    const forumChannel = await fullEvent.guild.channels.fetch(forumChannelId);
    const newThread = await forumChannel.threads.create({
      name: fullEvent.name,
      message: { content: fullEvent.url },
    });
    try {
      await saveThreadRecord(fullEvent.guildId, fullEvent.id, newThread.id);
      thread = newThread;
    } catch (e) {
      if (e.code === 11000) {
        // Race: another concurrent handler won — delete our orphaned thread and use theirs
        await newThread.delete().catch(() => {});
        const winner = await getThreadRecord(fullEvent.id);
        thread = await fullEvent.guild.channels.fetch(winner.threadId);
      } else {
        throw e;
      }
    }
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

async function handleEventInterestRemove(event, user) {
  const forumChannelId = SERVER_FORUM_MAP[event.guildId];
  if (!forumChannelId) {
    console.log(`[event-forum] No forum channel mapped for guild ${event.guildId} — skipping interest remove`);
    return;
  }

  const record = await getThreadRecord(event.id);
  if (!record) return;

  const fullEvent = event.partial ? await event.fetch() : event;
  const thread = await fullEvent.guild.channels.fetch(record.threadId);
  await thread.members.remove(user.id);
}

async function deleteThreadAndRecord(guild, record) {
  try {
    const thread = await guild.channels.fetch(record.threadId);
    await thread.delete();
  } catch (e) {
    console.log(`Thread ${record.threadId} already gone or unfetchable: ${e.message}`);
  }
  await deleteThreadRecord(record.eventId);
}

async function handleEventUpdate(oldEvent, newEvent) {
  const forumChannelId = SERVER_FORUM_MAP[newEvent.guildId];
  if (!forumChannelId) {
    console.log(`[event-forum] No forum channel mapped for guild ${newEvent.guildId} — skipping event update`);
    return;
  }
  if (newEvent.status !== GuildScheduledEventStatus.Canceled) return;

  const record = await getThreadRecord(newEvent.id);
  if (!record) return;

  const fullEvent = newEvent.partial ? await newEvent.fetch() : newEvent;
  await deleteThreadAndRecord(fullEvent.guild, record);
}

async function handleEventDelete(event) {
  const forumChannelId = SERVER_FORUM_MAP[event.guildId];
  if (!forumChannelId) {
    console.log(`[event-forum] No forum channel mapped for guild ${event.guildId} — skipping event delete`);
    return;
  }

  const record = await getThreadRecord(event.id);
  if (!record) return;

  // guild may be unavailable on a deleted event — fetch from client cache
  const guild = event.guild ?? event.client.guilds.cache.get(event.guildId);
  if (!guild) {
    console.log(`Guild ${event.guildId} not found on event delete, cleaning up DB only.`);
    await deleteThreadRecord(event.id);
    return;
  }
  await deleteThreadAndRecord(guild, record);
}

module.exports = { handleEventInterestAdd, handleEventInterestRemove, handleEventUpdate, handleEventDelete };
