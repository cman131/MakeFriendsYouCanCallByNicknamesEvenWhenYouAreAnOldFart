const https = require('https');
const Parser = require('rss-parser');
const { EmbedBuilder } = require('discord.js');
const { getCollection } = require('./db');

const parser = new Parser();
const FEED_URL = 'https://fetchrss.com/feed/1wbIs69eWCFo1wbIrWC6M2OQ.rss';
const CHANNEL_ID = '1518247826587521185';
const STATE_KEY = 'banned_restricted_last_link';

const MTG_FORMATS = [
  'Standard', 'Pioneer', 'Modern', 'Legacy', 'Vintage', 'Pauper',
  'Alchemy', 'Historic', 'Timeless', 'Brawl', 'Competitive Brawl', 'Commander',
];
const BAN_PATTERN = /\b(?:is banned|is restricted|is unbanned|is unrestricted)\b/i;

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchHtml(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

async function scrapeFormatChanges(url) {
  try {
    const html = await fetchHtml(url);
    const sections = html.split(/<h2[^>]*>/i);
    const lines = [];

    for (const section of sections) {
      const h2Match = section.match(/^([\s\S]*?)<\/h2>/i);
      if (!h2Match) continue;

      const formatName = stripHtml(h2Match[1]);
      if (!MTG_FORMATS.some(f => f.toLowerCase() === formatName.toLowerCase())) continue;

      const body = section.slice(h2Match[0].length);
      const changeLines = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
        .map(m => stripHtml(m[1]))
        .filter(text => BAN_PATTERN.test(text));

      if (changeLines.length === 0) continue;

      if (changeLines.length === 1) {
        lines.push(`**${formatName}**: ${changeLines[0]}`);
      } else {
        lines.push(`**${formatName}**:\n${changeLines.map(l => `• ${l}`).join('\n')}`);
      }
    }

    return lines.join('\n');
  } catch (err) {
    console.error('Error scraping B&R format changes:', err);
    return '';
  }
}

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
