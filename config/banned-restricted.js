const Parser = require('rss-parser');
const { EmbedBuilder } = require('discord.js');
const { getCollection } = require('./db');

const parser = new Parser();
const FEED_URL = 'https://fetchrss.com/feed/1wbIs69eWCFo1wbIrWC6M2OQ.rss';
const CHANNEL_ID = '1518247826587521185';
const STATE_KEY = 'banned_restricted_last_link';

async function postBannedRestricted(client) {
  try {
    const feed = await parser.parseURL(FEED_URL);

    // Find the newest B&R item anywhere in the feed (not just items[0]),
    // since B&R is rarely the single most-recent article in a general news feed.
    const article = (feed.items || []).find(item => {
      const t = (item.title || '').toLowerCase();
      return t.includes('banned') || t.includes('restricted');
    });
    if (!article) return; // no B&R announcement currently in the feed

    // Dedup against the last link we posted (persisted in Mongo).
    const col = getCollection('botState');
    const state = await col.findOne({ _id: STATE_KEY });
    if (state && state.link === article.link) return; // already posted

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle(article.title)
      .setURL(article.link)
      .setDescription(article.contentSnippet
        || 'A new MTG Banned and Restricted announcement has been released.')
      .setColor('#FF0000')
      .setTimestamp(article.pubDate ? new Date(article.pubDate) : new Date())
      .setFooter({ text: 'Wizards of the Coast Official' });

    await channel.send({
      content: '🚨 **New MTG Ban Announcement!** 🚨',
      embeds: [embed],
    });

    await col.updateOne(
      { _id: STATE_KEY },
      { $set: { link: article.link, title: article.title, postedAt: new Date() } },
      { upsert: true }
    );
  } catch (error) {
    console.error('Error checking MTG B&R feed:', error);
  }
}

module.exports = { postBannedRestricted };
