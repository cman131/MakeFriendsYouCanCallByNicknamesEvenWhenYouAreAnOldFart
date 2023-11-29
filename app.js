const { Client } = require('discord.js');
const schedule = require('node-schedule');
const { botIntents, commands } = require('./config/config');
const config = require('./config/default');

const client = new Client({
  intents: botIntents,
  partials: ['CHANNEL', 'MESSAGE', 'GUILDSCHEDULEDEVENT', 'USER', 'GUILDMEMBER'],
});

client.on('ready', () => {
  console.log('Logged in as ' + client.user.tag);
});

client.login(config.DISCORD_TOKEN);
const prefix = '!';

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

//client.on('guildScheduledEventUserAdd', (event, user) => {
//    const eventMsg = 'You\'ve signed up for: ' + event.name + '\n' + event.url;
//    user.send(eventMsg);
//});

// 5pm EST (10pm GMT)
schedule.scheduleJob({
    hour: 22,
    minute: 0,
    second: 0
}, () => {
    const currentDate = new Date();
    client.guilds.cache.forEach(guild => {
        guild.scheduledEvents.cache.forEach(event => {
            // Set the alert date for the day before the event in EST
            let alertDate = event.startDate ?? new Date(event.scheduledStartTimestamp);
            alertDate.setHours(alertDate.getHours() - 5);
            alertDate.setDate(alertDate.getDate() - 1);
            if (
                currentDate.getYear() === alertDate.getYear() &&
                currentDate.getDay() === alertDate.getDay() &&
                currentDate.getMonth() === alertDate.getMonth()
            ) {
              console.log(currentDate);
              console.log(alertDate);
              console.log(event.scheduledStartAt);
              console.log(event.scheduledStartTimestamp);

              event.fetchSubscribers().then(attendees => {
                  let values = attendees.values();
                  for (let member of values) {
                      let user = member.user;
                      console.log(`Messaged ${user.username} about the ${event.name} event.`);
                      try {
                        user.send(`**${event.name}** is coming up tomorrow and you are signed up to join! If your plans have changed, please update your status on the event.\n${event.url}`);
                      } catch (e) {
                        console.log(`Failed to message ${user.username} about ${event.name}. Error: ${e}`)
                      }
                  }
              });
            }
        })
    });
});