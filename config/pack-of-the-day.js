const https = require('https');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept': 'text/html' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchText(res.headers.location).then(resolve).catch(reject);
        res.resume();
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

const CUBE_ID = 'c0510d57-2efa-4df3-9df8-22bde1e0e08f';
const CHANNEL_IDS = ['1516781329633509396', '368545752580096011'];

// messageId -> { baseContent, userVotes: Map<userId, pick>, counts: Map<pick, number>, cardNames: Map<pick, string> }
const packVoteState = new Map();

function randomSeed() {
  return Math.floor(Math.random() * (9999999999999 - 1000000000000 + 1)) + 1000000000000;
}

function buildPackRows() {
  const rows = [];
  for (let r = 1; r <= 3; r++) {
    const row = new ActionRowBuilder();
    for (let c = 1; c <= 5; c++) {
      const pick = `${r}-${c}`;
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`pack_vote_${pick}`)
          .setLabel(pick)
          .setStyle(ButtonStyle.Primary)
      );
    }
    rows.push(row);
  }
  return rows;
}

function buildTallyText(counts, cardNames) {
  const nonZero = [...counts.entries()].filter(([, n]) => n > 0);
  if (nonZero.length === 0) return '';
  const total = nonZero.reduce((sum, [, n]) => sum + n, 0);
  const parts = nonZero.map(([pick, n]) => {
    const name = cardNames?.get(pick);
    const label = name ? `${name} (${pick})` : pick;
    return `${label}: ${Math.round(n / total * 100)}%`;
  }).join(' | ');
  return `\nVotes (${total} total):\n${parts}`;
}

async function fetchCardNames(seed) {
  const cardNames = new Map();
  try {
    const html = await fetchText(`https://cubecobra.com/cube/samplepack/${CUBE_ID}/${seed}`);
    const match = html.match(/window\.reactProps\s*=\s*([\s\S]*?);\s*<\/script>/);
    if (!match) return cardNames;
    const props = JSON.parse(match[1]);
    (props.pack ?? []).forEach((card, i) => {
      const row = Math.floor(i / 5) + 1;
      const col = (i % 5) + 1;
      const name = card.details?.name ?? card.name;
      if (name) cardNames.set(`${row}-${col}`, name);
    });
  } catch (e) {
    console.log(`Failed to fetch pack card names: ${e}`);
  }
  return cardNames;
}

async function postPackToChannel(channel) {
  const seed = randomSeed();
  const imageUrl = `https://cubecobra.com/cube/samplepackimage/${CUBE_ID}/${seed}`;
  const baseContent = `New day, new pack!\nWhat is your pack 1 pick 1?\n\n${imageUrl}`;
  const cardNames = await fetchCardNames(seed);
  const rows = buildPackRows();
  const msg = await channel.send({ content: baseContent, components: rows });
  packVoteState.set(msg.id, {
    baseContent,
    userVotes: new Map(),
    counts: new Map(),
    cardNames,
  });
}

function postPackOfTheDay(client) {
  for (const channelId of CHANNEL_IDS) {
    const channel = client.channels.cache.get(channelId);
    if (channel) postPackToChannel(channel);
  }
}

function handlePackVote(interaction) {
  const pick = interaction.customId.replace('pack_vote_', '');
  const state = packVoteState.get(interaction.message.id);

  if (!state) {
    return interaction.reply({ content: 'Vote state not found (bot may have restarted).', ephemeral: true });
  }
  if (state.userVotes.has(interaction.user.id)) {
    return interaction.reply({ content: 'You already voted!', ephemeral: true });
  }

  state.userVotes.set(interaction.user.id, pick);
  state.counts.set(pick, (state.counts.get(pick) ?? 0) + 1);

  const newContent = state.baseContent + buildTallyText(state.counts, state.cardNames);
  return interaction.update({ content: newContent, components: buildPackRows() });
}

module.exports = { postPackOfTheDay, postPackToChannel, handlePackVote };
