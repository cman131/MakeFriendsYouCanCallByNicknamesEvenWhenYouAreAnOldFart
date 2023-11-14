const { GatewayIntentBits } = require('discord.js');
const https = require('https');
const querystring = require('querystring');
const config = require('./default');
const r2 = require('r2');

const DOG_API_URL   = "https://api.thedogapi.com/"

const botIntents = [
  GatewayIntentBits.DirectMessages,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.Guilds,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildScheduledEvents,
];

const insult = (msg) => {
  const name = msg.author.username;
  https.get('https://insult.mattbas.org/api/insult.json?who=' + name, response => {
    let body = '';
    response.on('data', function(chunk) {
      body += chunk;
    });
    response.on('end', function() {
      const json = JSON.parse(body);
      msg.reply(json.insult);
    });
  });
};

const inspiration = (msg) => {
  https.get('https://inspirobot.me/api?generate=true', response => {
    let body = '';
    response.on('data', function(chunk) {
      body += chunk;
    });
    response.on('end', function() {
      msg.reply(body);
    });
  });
};

async function getDog(msg) {
  var headers = {
      'X-API-KEY': config.DOG_API_KEY,
  }
  var query_params = {
    'has_breeds':true, // we only want images with at least one breed data object - name, temperament etc
    'mime_types':'jpg,png', // we only want static images as Discord doesn't like gifs
    'size':'small',   // get the small images as the size is prefect for Discord's 390x256 limit
    'sub_id': msg.author.username, // pass the message senders username so you can see how many images each user has asked for in the stats
    'limit' : 1       // only need one
  }
  // convert this object to query string 
  let queryString = querystring.stringify(query_params);
  try {
    // construct the API Get request url
    let _url = DOG_API_URL + `v1/images/search?${queryString}`;
    // make the request passing the url, and headers object which contains the API_KEY
    const response = await r2.get(_url , {headers} ).json
    msg.reply(response[0].url);
  } catch (e) {
      console.log(e)
  }
}

const pollNotation = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const makePoll = (msg) => {
  let content = msg.content.slice(5);
  const parts = content.split('|');
  if (parts.length > 12) {
    msg.reply('Sorry, only up to 11 options allowed in a poll right now.');
    return;
  }
  let message = `**${parts[0]}**\n-----------------------------\n`;
  for(let i = 1; i < parts.length; i++) {
    message += `${pollNotation[i - 1]} ${parts[i]}\n`;
  }
  msg.reply(message).then(reply => {
    for(let i = 0; i < parts.length - 1; i++) {
      reply.react(pollNotation[i]);
    }
  });
};


let commands = {
  'dognow': {
    description: 'When you need a doggy picture right the heckity heck now.',
    invoke: getDog
  },
  'flareon': {
    description: 'Posts the flareon copypasta. A significantly more wholesome copypasta than that of Vaporeon.',
    invoke: (msg) => msg.reply('Hey guys, did you know that in terms of human companionship, Flareon is objectively the most huggable Pokemon? While their maximum temperature is likely too much for most, they are capable of controlling it, so they can set themselves to the perfect temperature for you. Along with that, they have a lot of fluff, making them undeniably incredibly soft to touch. But that\'s not all, they have a very respectable special defense stat of 110, which means that they are likely very calm and resistant to emotional damage. Because of this, if you have a bad day, you can vent to it while hugging it, and it won\'t mind. It can make itself even more endearing with moves like Charm and Baby Doll Eyes, ensuring that you never have a prolonged bout of depression ever again.')
  },
  'getmyname': {
    description: 'Gets your username.',
    invoke: (msg) => msg.reply(msg.author.username)
  },
  'insultme': {
    description: 'Feeling too good about yourself? Tired of compliments? Is your name "Sarah"? Try this command to get insulted and taken down a peg.',
    invoke: insult
  },
  'inspireme': {
    description: 'Get an Inspirobot generated inspirational image.',
    invoke: inspiration
  },
  'motivateme': {
    description: 'Get some motivation to improve your day.',
    invoke: (msg) => msg.reply('https://www.youtube.com/watch?v=KxGRhd_iWuE')
  },
  'poll': {
    description: 'Make a new poll using the format: "!poll <question>|<option1>|<option2>|<option3>"',
    invoke: makePoll
  },
  'vaporeon': {
    description: 'Posts the vaporeon copypasta in spoiler tags. Don\'t use this one. Just don\'t',
    invoke: (msg) => msg.reply('|| Hey guys, did you know that in terms of male human and female Pokémon breeding, Vaporeon is the most compatible Pokémon for humans? Not only are they in the field egg group, which is mostly comprised of mammals, Vaporeon are an average of 3”03’ tall and 63.9 pounds, this means they’re large enough to be able handle human dicks, and with their impressive Base Stats for HP and access to Acid Armor, you can be rough with one. Due to their mostly water based biology, there’s no doubt in my mind that an aroused Vaporeon would be incredibly wet, so wet that you could easily have sex with one for hours without getting sore. They can also learn the moves Attract, Baby-Doll Eyes, Captivate, Charm, and Tail Whip, along with not having fur to hide nipples, so it’d be incredibly easy for one to get you in the mood. With their abilities Water Absorb and Hydration, they can easily recover from fatigue with enough water. No other Pokémon comes close to this level of compatibility. Also, fun fact, if you pull out enough, you can make your Vaporeon turn white. Vaporeon is literally built for human dick. Ungodly defense stat+high HP pool+Acid Armor means it can take cock all day, all shapes and sizes and still come for more ||')
  },
};
commands['help'] = {
  description: 'Get the list of commands available.',
  invoke: (msg) => msg.reply(
    '**Available commands**\n' +
    '------------------\n' +
    Object.keys(commands).map(cmd => `**!${cmd}**: ${commands[cmd].description}`).join('\n')
    )
};

module.exports = { botIntents, commands }