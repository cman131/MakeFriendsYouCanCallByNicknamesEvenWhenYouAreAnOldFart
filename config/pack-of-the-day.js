const https = require('https');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getCollection } = require('./db');

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

function randomSeed() {
  return Math.floor(Math.random() * (9999999999999 - 1000000000000 + 1)) + 1000000000000;
}

const LABEL_FILTER = new Set(['a', 'an', 'the', 'of', 'to', 'and', 'or', 'in', 'on', 'at', 'for', 'with']);

function getButtonLabel(pick, cardNames) {
  const name = cardNames?.get(pick);
  let buttonLabel = pick.replace('-', '');
  if (!name) return buttonLabel;
  const words = name.split(' ').filter(w => !LABEL_FILTER.has(w.toLowerCase()));
  if (words.length >= 2) {
    buttonLabel = words.map(w => w[0].toUpperCase()).join('');
  }
  if (words.length === 1)
  {
    buttonLabel = words[0][0] + words[0][1];
  }
  return buttonLabel.slice(0, 2);
}

function buildPackRows(cardNames) {
  const rows = [];
  for (let r = 1; r <= 3; r++) {
    const row = new ActionRowBuilder();
    for (let c = 1; c <= 5; c++) {
      const pick = `${r}-${c}`;
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`pack_vote_${pick}`)
          .setLabel(getButtonLabel(pick, cardNames))
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
  const sorted = nonZero.sort(([, a], [, b]) => b - a).slice(0, 5);
  const parts = sorted.map(([pick, n], i) => {
    const name = cardNames?.get(pick);
    const label = name ? `${name} (${n})` : `${pick} (${n})`;
    return `${i + 1}. ${label}: ${Math.round(n / total * 100)}%`;
  }).join('\n');
  return `\nVotes (${total} total):\n||${parts}||`;
}

async function fetchPackCards(seed) {
  const cardNames = new Map();
  const cards = [];
  try {
    const html = await fetchText(`https://cubecobra.com/cube/samplepack/${CUBE_ID}/${seed}`);
    const match = html.match(/window\.reactProps\s*=\s*([\s\S]*?);\s*<\/script>/);
    if (!match) return { cardNames, cards };
    const props = JSON.parse(match[1].replace(/:\s*undefined\b/g, ':null'));
    (props.pack ?? []).forEach((card, i) => {
      const row = Math.floor(i / 5) + 1;
      const col = (i % 5) + 1;
      const pick = `${row}-${col}`;
      const name = card.details?.name ?? card.name;
      if (name) cardNames.set(pick, name);
      cards.push({
        pick,
        name: name ?? null,
        color_identity: card.details?.color_identity,
        scryfall_id: card.details?.scryfall_id,
        cmc: card.details?.cmc,
        type: card.details?.type,
      });
    });
  } catch (e) {
    console.error(`Failed to fetch pack card names: ${e}`);
  }
  return { cardNames, cards };
}

async function postPackToChannel(channel) {
  const seed = randomSeed();
  const imageUrl = `https://cubecobra.com/cube/samplepackimage/${CUBE_ID}/${seed}`;
  const baseContent = `New day, new pack!\nWhat is your pack 1 pick 1?\n\n${imageUrl}`;
  const { cardNames, cards } = await fetchPackCards(seed);
  const rows = buildPackRows(cardNames);
  const msg = await channel.send({ content: baseContent, components: rows });
  await getCollection('packSessions').insertOne({
    messageId: msg.id,
    channelId: channel.id,
    cubeId: CUBE_ID,
    seed,
    imageUrl,
    baseContent,
    postedAt: new Date(),
    cards,
    votes: [],
  }).catch(e => console.error('Pack DB insert failed:', e));
}

function postPackOfTheDay(client) {
  for (const channelId of CHANNEL_IDS) {
    const channel = client.channels.cache.get(channelId);
    if (channel) postPackToChannel(channel);
  }
}

async function handlePackVote(interaction) {
  const pick = interaction.customId.replace('pack_vote_', '');
  const messageId = interaction.message.id;

  const session = await getCollection('packSessions').findOneAndUpdate(
    { messageId, 'votes.userId': { $ne: interaction.user.id } },
    { $push: { votes: { userId: interaction.user.id, pick, votedAt: new Date() } } },
    { returnDocument: 'after', maxTimeMS: 2000 }
  );

  if (!session) {
    const existing = await getCollection('packSessions').findOne(
      { messageId },
      { projection: { cards: 1, votes: 1 }, maxTimeMS: 2000 }
    );
    if (!existing) {
      return interaction.reply({ content: 'Pack session not found.', ephemeral: true });
    }
    const userVote = existing.votes?.find(v => v.userId === interaction.user.id);
    const priorCardName = userVote
      ? new Map((existing.cards ?? []).filter(c => c.name).map(c => [c.pick, c.name])).get(userVote.pick)
      : null;
    const alreadyVotedMsg = priorCardName
      ? `You already voted for ${priorCardName}!`
      : 'You already voted!';
    return interaction.reply({ content: alreadyVotedMsg, ephemeral: true });
  }

  const cardNames = new Map((session.cards ?? []).filter(c => c.name).map(c => [c.pick, c.name]));
  const counts = new Map();
  for (const { pick: p } of session.votes) {
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  const newContent = session.baseContent + '\n----' + buildTallyText(counts, cardNames) + '\n----';
  return interaction.update({ content: newContent, components: buildPackRows(cardNames) });
}

module.exports = { postPackOfTheDay, postPackToChannel, handlePackVote };
