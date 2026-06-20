const CUBE_ID = 'c0510d57-2efa-4df3-9df8-22bde1e0e08f';
const CHANNEL_IDS = ['1516781329633509396', '368545752580096011'];

function randomSeed() {
  return Math.floor(Math.random() * (9999999999999 - 1000000000000 + 1)) + 1000000000000;
}

function postPackToChannel(channel) {
  const imageUrl = `https://cubecobra.com/cube/samplepackimage/${CUBE_ID}/${randomSeed()}`;
  const message = `New day, new pack!\n What is your pack 1 pick 1? \n\n ${imageUrl}`;
  channel.send(message)
    .catch(e => console.log(`Failed to post pack of the day to ${channel.id}: ${e}`));
}

function postPackOfTheDay(client) {
  for (const channelId of CHANNEL_IDS) {
    const channel = client.channels.cache.get(channelId);
    if (channel) postPackToChannel(channel);
  }
}

module.exports = { postPackOfTheDay, postPackToChannel };
