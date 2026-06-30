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
const BAN_ACTION_RE = /\b(?:is banned|is restricted|is unbanned|is unrestricted)\b/i;
const NARRATIVE_START_RE = /^(?:For |Due |As |Because |Since |Therefore |To |In |This |The |With |While |Given |After |During |Although |However |Furthermore |Moreover |Additionally )/i;

function fetchHtml(url, depth = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (depth >= 5) return reject(new Error('Too many redirects'));
        const resolved = new URL(res.headers.location, url).href;
        return fetchHtml(resolved, depth + 1).then(resolve).catch(reject);
      }
      if (res.statusCode >= 400) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
      res.on('error', reject);
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
        .flatMap(m => m[1].replace(/<br\s*\/?>/gi, '\n').split('\n'))
        .map(line => stripHtml(line))
        .filter(text => BAN_ACTION_RE.test(text) && !NARRATIVE_START_RE.test(text));

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

    const article = (feed.items || []).find(item => {
      const t = (item.title || '').toLowerCase();
      return t.includes('banned') || t.includes('restricted');
    });
    if (!article) return;

    const col = getCollection('botState');
    const state = await col.findOne({ _id: STATE_KEY });
    if (state && state.link === article.link) return;

    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) return;

    const formatList = await scrapeFormatChanges(article.link);
    const fallback = 'A new MTG Banned and Restricted announcement has been released.';
    const description = formatList
      ? `${formatList}\n\n${article.contentSnippet || fallback}`
      : (article.contentSnippet || fallback);

    const embed = new EmbedBuilder()
      .setTitle(article.title)
      .setURL(article.link)
      .setDescription(description)
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
