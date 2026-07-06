const { Client, GuildScheduledEventStatus } = require('discord.js');
const schedule = require('node-schedule');
const { botIntents, commands, clearLetsPlayChannelMap } = require('./config/config');
const { postPackOfTheDay, handlePackVote } = require('./config/pack-of-the-day');
const { postBannedRestricted } = require('./config/banned-restricted');
const { connectDb } = require('./config/db');
const config = require('./config/default');
const { handleEventInterestAdd, handleEventInterestRemove, handleEventUpdate, handleEventDelete } = require('./config/event-forum');

const client = new Client({
  intents: botIntents,
  partials: ['CHANNEL', 'MESSAGE', 'GUILDSCHEDULEDEVENT', 'USER', 'GUILDMEMBER'],
});

client.on('ready', () => {
  console.log('Logged in as ' + client.user.tag);
});

const prefix = '!';

(async () => {
  try {
    await connectDb();
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  }
  client.login(config.DISCORD_TOKEN).catch(err => {
    console.error('Failed to log in to Discord:', err);
    process.exit(1);
  });
})();

client.on('messageCreate', (msg) => {
  if (msg.author.bot) return;

  const content = msg.content ?? '';
  // Horse bow!
  if (content.toUpperCase().includes('HORSE') && content.toUpperCase().includes('BOW')) {
    msg.react('🐴');
    msg.react('🏹');
  }

  if (!content.startsWith(prefix)) return; // do nothing if command is not preceded with prefix

  const userCmd = content.split(' ')[0].slice(prefix.length);

  if (userCmd in commands) {
    commands[userCmd].invoke(msg);
  }
});

client.on('interactionCreate', (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId.startsWith('pack_vote_')) {
    handlePackVote(interaction).catch(e => console.error('Vote handler failed:', e));
  }
});

client.on('guildScheduledEventUserAdd', (event, user) => {
  handleEventInterestAdd(event, user).catch(e => console.error('Event interest add failed:', e));
});

client.on('guildScheduledEventUserRemove', (event, user) => {
  handleEventInterestRemove(event, user).catch(e => console.error('Event interest remove failed:', e));
});

client.on('guildScheduledEventUpdate', (oldEvent, newEvent) => {
  handleEventUpdate(oldEvent, newEvent).catch(e => console.error('Event update failed:', e));
});

client.on('guildScheduledEventDelete', (event) => {
  handleEventDelete(event).catch(e => console.error('Event delete failed:', e));
});

// 5pm EST (10pm GMT)
const eventAlertRule = new schedule.RecurrenceRule();
eventAlertRule.hour = 17;
eventAlertRule.minute = 0;
eventAlertRule.second = 0;
eventAlertRule.tz = 'America/New_York';
schedule.scheduleJob(eventAlertRule, () => {
  alertAttendees();
});

// 10am EST (3pm GMT)
const packQuizRule = new schedule.RecurrenceRule();
packQuizRule.hour = 10;
packQuizRule.minute = 0;
packQuizRule.second = 0;
packQuizRule.tz = 'America/New_York';
schedule.scheduleJob(packQuizRule, () => {
  postPackOfTheDay(client);
});

// 2am daily: clear letsplay lobbies
const lobbyRule = new schedule.RecurrenceRule();
lobbyRule.hour = 2;
lobbyRule.minute = 0;
lobbyRule.second = 0;
lobbyRule.tz = 'America/New_York';
schedule.scheduleJob(lobbyRule, () => {
  clearLetsPlayChannelMap();
});

// 2:30pm US Eastern: check for a new Banned & Restricted announcement
const brRule = new schedule.RecurrenceRule();
brRule.hour = 14;
brRule.minute = 30;
brRule.second = 0;
brRule.tz = 'America/New_York';
schedule.scheduleJob(brRule, () => {
  postBannedRestricted(client);
});

function alertAttendees() {
  const currentDate = new Date();
  client.guilds.cache.forEach(guild => {
      guild.scheduledEvents.cache.forEach(event => {
          // Set the alert date for the day before the event in EST
          let alertDate = event.startDate ?? new Date(event.scheduledStartTimestamp);
          alertDate.setHours(alertDate.getHours() - 5);
          alertDate.setDate(alertDate.getDate() - 1);
          if (
              event.status != GuildScheduledEventStatus.Canceled &&
              event.status != GuildScheduledEventStatus.Completed &&
              currentDate.getFullYear() === alertDate.getFullYear() &&
              currentDate.getDate() === alertDate.getDate() &&
              currentDate.getMonth() === alertDate.getMonth()
          ) {
            event.fetchSubscribers().then(attendees => {
                let values = attendees.values();
                for (let member of values) {
                    let user = member.user;
                    console.log(`Messaged ${user.username} about the ${event.name} event.`);
                    try {
                      user.send(`**${event.name}** is coming up tomorrow and you are signed up to join! If your plans have changed, please update your status on the event.\n${event.url}`)
                        .catch((e) => console.log(`Failed to message ${user.username} about ${event.name}. Error: ${e}`));
                    } catch (e) {
                      console.log(`Failed to message ${user.username} about ${event.name}. Error: ${e}`);
                    }
                }
            });
          }
      })
  });
}