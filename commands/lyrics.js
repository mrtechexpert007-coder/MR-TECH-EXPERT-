// ⟦EXPERT / NEXUS-MD⟧ .lyrics — fetch song lyrics (LRCLIB + lyrics.ovh)
// Usage: .lyrics Adele - Hello   |   .lyrics Hello Adele

import axios from 'axios';

const UA = 'ＰＲＩＮＣＥ ＭＩＮＩ Lyrics/1.0 (https://github.com/nexus-md)';

function parseQuery(text) {
  const t = String(text || '').trim();
  if (!t) return null;

  // Artist - Title | Artist – Title | Artist — Title
  let m = t.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (m) return { artist: m[1].trim(), title: m[2].trim(), q: t };

  // Title by Artist
  m = t.match(/^(.+?)\s+by\s+(.+)$/i);
  if (m) return { artist: m[2].trim(), title: m[1].trim(), q: t };

  return { artist: '', title: t, q: t };
}

function cleanLyrics(s) {
  return String(s || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripLrc(synced) {
  return String(synced || '')
    .replace(/\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fromLrclib(parsed) {
  const headers = { 'User-Agent': UA, Accept: 'application/json' };

  // 1) search
  const search = await axios.get('https://lrclib.net/api/search', {
    params: { q: parsed.q },
    headers,
    timeout: 15000,
    validateStatus: () => true
  });

  if (search.status !== 200 || !Array.isArray(search.data) || !search.data.length) {
    // direct get if artist+title known
    if (parsed.artist && parsed.title) {
      const get = await axios.get('https://lrclib.net/api/get', {
        params: {
          artist_name: parsed.artist,
          track_name: parsed.title
        },
        headers,
        timeout: 15000,
        validateStatus: () => true
      });
      if (get.status === 200 && get.data) {
        const lyr =
          cleanLyrics(get.data.plainLyrics) || stripLrc(get.data.syncedLyrics);
        if (lyr) {
          return {
            source: 'lrclib',
            title: get.data.trackName || parsed.title,
            artist: get.data.artistName || parsed.artist,
            album: get.data.albumName || '',
            lyrics: lyr
          };
        }
      }
    }
    return null;
  }

  // Prefer entry with plain lyrics
  let best =
    search.data.find((x) => x.plainLyrics && String(x.plainLyrics).length > 40) ||
    search.data.find((x) => x.syncedLyrics) ||
    search.data[0];

  // If search hit has no body, fetch by id via get with names
  let lyrics =
    cleanLyrics(best.plainLyrics) || stripLrc(best.syncedLyrics) || '';

  if (!lyrics && best.artistName && best.trackName) {
    const get = await axios.get('https://lrclib.net/api/get', {
      params: {
        artist_name: best.artistName,
        track_name: best.trackName,
        album_name: best.albumName || undefined,
        duration: best.duration || undefined
      },
      headers,
      timeout: 15000,
      validateStatus: () => true
    });
    if (get.status === 200 && get.data) {
      lyrics =
        cleanLyrics(get.data.plainLyrics) || stripLrc(get.data.syncedLyrics) || '';
      best = { ...best, ...get.data };
    }
  }

  if (!lyrics) return null;

  return {
    source: 'lrclib',
    title: best.trackName || parsed.title || parsed.q,
    artist: best.artistName || parsed.artist || 'Unknown',
    album: best.albumName || '',
    lyrics
  };
}

async function fromLyricsOvh(parsed) {
  if (!parsed.artist || !parsed.title) {
    // try suggest
    try {
      const sug = await axios.get(
        `https://api.lyrics.ovh/suggest/${encodeURIComponent(parsed.q)}`,
        {
          headers: { 'User-Agent': UA },
          timeout: 12000,
          validateStatus: () => true
        }
      );
      const hit = sug.data?.data?.[0];
      if (hit?.artist?.name && hit?.title) {
        parsed = {
          artist: hit.artist.name,
          title: hit.title,
          q: `${hit.artist.name} - ${hit.title}`
        };
      }
    } catch {}
  }

  if (!parsed.artist || !parsed.title) return null;

  const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(parsed.artist)}/${encodeURIComponent(parsed.title)}`;
  const res = await axios.get(url, {
    headers: { 'User-Agent': UA },
    timeout: 15000,
    validateStatus: () => true
  });

  if (res.status !== 200 || !res.data?.lyrics) return null;
  const lyrics = cleanLyrics(res.data.lyrics);
  if (!lyrics || lyrics.length < 20) return null;

  return {
    source: 'lyrics.ovh',
    title: parsed.title,
    artist: parsed.artist,
    album: '',
    lyrics
  };
}

function chunkText(text, max = 3500) {
  const parts = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max);
    if (cut < max * 0.5) cut = max;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n+/, '');
  }
  if (rest) parts.push(rest);
  return parts;
}

function getText(expert) {
  return (
    expert.args?.join?.(' ') ||
    expert.text ||
    expert.body ||
    ''
  )
    .replace(/^\.[a-z]+\s*/i, '')
    .trim();
}

export default {
  name: 'lyrics',
  aliases: ['lyric', 'lirik', 'lyr'],
  desc: 'Get song lyrics — .lyrics Artist - Title',
  async run(expert) {
    const q = getText(expert);
    if (!q) {
      return expert.reply(
        `🎵 *LYRICS*\n\n` +
          `Usage:\n` +
          `• \`.lyrics Adele - Hello\`\n` +
          `• \`.lyrics Hello by Adele\`\n` +
          `• \`.lyrics Bohemian Rhapsody\`\n\n` +
          `_EXPERT MINI BOT_`
      );
    }

    await expert.react?.('🔎').catch?.(() => {});

    try {
      const parsed = parseQuery(q);
      let result = null;
      const errors = [];

      try {
        result = await fromLrclib(parsed);
      } catch (e) {
        errors.push('lrclib: ' + e.message);
      }

      if (!result) {
        try {
          result = await fromLyricsOvh(parsed);
        } catch (e) {
          errors.push('lyrics.ovh: ' + e.message);
        }
      }

      if (!result?.lyrics) {
        await expert.react?.('❌').catch?.(() => {});
        return expert.reply(
          `❌ *Lyrics not found*\nQuery: ${q}\n` +
            (errors.length ? errors.join('\n') : 'Try: Artist - Title')
        );
      }

      const header =
        `🎵 *${result.title}*\n` +
        `👤 ${result.artist}` +
        (result.album ? `\n💿 ${result.album}` : '') +
        `\n📡 ${result.source}\n\n`;

      const body = result.lyrics;
      const full = header + body;

      if (full.length <= 3800) {
        await expert.reply(full + `\n\n_EXPERT MINI BOT_`);
      } else {
        const chunks = chunkText(body, 3400);
        await expert.reply(header + chunks[0]);
        for (let i = 1; i < chunks.length; i++) {
          await expert.reply(`*(${i + 1}/${chunks.length})*\n\n` + chunks[i]);
        }
        await expert.reply('_EXPERT MINI BOT_').catch?.(() => {});
      }

      await expert.react?.('✅').catch?.(() => {});
    } catch (e) {
      console.error('[lyrics]', e);
      await expert.reply(`❌ *Lyrics failed*\n${e.message || e}`);
      await expert.react?.('❌').catch?.(() => {});
    }
  }
};
