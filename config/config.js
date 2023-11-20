const { GatewayIntentBits } = require('discord.js');
const querystring = require('querystring');
const config = require('./default');
const r2 = require('r2');

const botIntents = [
  GatewayIntentBits.DirectMessages,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.Guilds,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildScheduledEvents,
];

async function insult(msg) {
  const url = 'https://insult.mattbas.org/api/insult.json';
  const queryParams = { who: msg.author.username };
  await getApiCall(url, queryParams, {}, response => {
    msg.reply(response.insult);
  });
}

async function inspiration(msg) {
  const url = 'https://inspirobot.me/api';
  const queryParams = { generate: true };
  await getApiCall(url, queryParams, {}, response => {
    msg.reply(response);
  }, console.log, false);
}

async function getDog(msg) {
  getAnimal(msg, 'dog');
}

async function getCat(msg) {
  getAnimal(msg, 'cat');
}

async function getAnimal(msg, animal) {
  const apiBaseUrl = `https://api.the${animal}api.com/v1/images/search`;
  const headers = {
      'X-API-KEY': config.DOG_API_KEY,
  }
  const queryParams = {
    'has_breeds':true, // we only want images with at least one breed data object - name, temperament etc
    'mime_types':'jpg,png', // we only want static images as Discord doesn't like gifs
    'size':'small',   // get the small images as the size is prefect for Discord's 390x256 limit
    'sub_id': msg.author.username, // pass the message senders username so you can see how many images each user has asked for in the stats
    'limit' : 1       // only need one
  }
  await getApiCall(apiBaseUrl, queryParams, headers, response => msg.reply(response[0].url));
}

const pollNotation = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const makePoll = (msg) => {
  let content = msg.content.slice(5);
  const parts = content.split('|');
  if (parts.length > 12) {
    msg.reply('Sorry, only up to 11 options allowed in a poll right now.');
    return;
  } else if (parts.length <= 1) {
    msg.reply('Don\'t you want options in your poll?');
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

const kylerPics = [
  'https://imgur.com/buhSDql',
  'https://imgur.com/hSVtkk0',
  'https://imgur.com/TIo0mQW',
  'https://imgur.com/1BSuqCt',
  'https://imgur.com/WvDRwI6',
  'https://imgur.com/OdC4PI2',
  'https://imgur.com/P8dkdKU',
  'https://imgur.com/VqzxsEY',
  'https://imgur.com/bpHTjBZ',
  'https://imgur.com/hPix0Bc',
  'https://imgur.com/bDxuRCd',
  'https://imgur.com/VwEcL99',
  'https://imgur.com/MmPDFkk',
  'https://imgur.com/YLD9Leo',
  'https://imgur.com/kabTy8t',
  'https://imgur.com/d2PejtN',
  'https://imgur.com/2IIYATL',
  'https://imgur.com/8i0R4Jf',
  'https://imgur.com/a/Vt944Ic',
];

let commands = {
  'catnow': {
    description: 'When you, for some unexplained reason, are confused and desire a cat picture instead of a dog one.',
    invoke: getCat
  },
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
  'kylernow': {
    description: 'When you find your life lacking the beautiful visage of everyone\'s wonderful friend, Kyler.',
    invoke: (msg) => msg.reply(kylerPics[Math.floor(Math.random() * kylerPics.length)])
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
const helpAliases = ['help', 'commands', 'commandlist', 'man'];
helpAliases.forEach(cmd => {
  commands[cmd] = {
    description: 'Get the list of commands available.',
    invoke: (msg) => msg.reply(
      '**Available commands**\n' +
      '------------------\n' +
      Object.keys(commands).map(cmd => `**!${cmd}**: ${commands[cmd].description}`).join('\n')
      )
  };
});

async function getApiCall(url, queryParams, headers, onSuccess, onError = console.log, shouldReadAsJson = true) {
  // convert this object to query string 
  let queryString = querystring.stringify(queryParams);

  try {
    // construct the API Get request url
    let _url = `${url}?${queryString}`;
    // make the request passing the url, and headers object which contains the API_KEY
    let response;
    if (shouldReadAsJson) {
      response = await r2.get(_url , { headers } ).json;
    } else {
      response = await r2.get(_url , { headers } ).text;
    }
    onSuccess(response);
  } catch (e) {
      onError(e)
  }
}

module.exports = { botIntents, commands }
