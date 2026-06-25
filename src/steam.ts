import type { Embed } from "./discord.js";

const STEAM_BLUE = 0x66c0f4;

export type NewsItem = {
  gid: string;
  title: string;
  url: string;
  contents: string;
  feedlabel: string;
  date: number; // unix seconds
};

// Public, no API key needed. By default we restrict to the game's own
// announcements feed (steam_community_announcements) so we get official patch
// notes / dev posts, not third-party gaming press. Pass includePress to widen it.
export async function fetchSteamNews(
  appid: number,
  includePress: boolean,
  count = 5,
): Promise<NewsItem[]> {
  const feeds = includePress ? "" : "&feeds=steam_community_announcements";
  const url =
    `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/` +
    `?appid=${appid}&count=${count}&maxlength=600${feeds}&format=json`;
  const res = await fetch(url, { headers: { "user-agent": "game-news-bot" } });
  if (!res.ok) throw new Error(`Steam news ${appid}: HTTP ${res.status}`);
  const data = (await res.json()) as { appnews?: { newsitems?: NewsItem[] } };
  return data.appnews?.newsitems ?? [];
}

// Steam "contents" is BBCode-ish with stray HTML; strip it for the embed body.
function clean(text: string, max = 350): string {
  const t = text
    .replace(/\[\/?[^\]]+\]/g, "")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function steamEmbed(appid: number, name: string, item: NewsItem): Embed {
  return {
    title: item.title.slice(0, 256) || "New update",
    url: item.url,
    description: clean(item.contents),
    color: STEAM_BLUE,
    timestamp: new Date(item.date * 1000).toISOString(),
    footer: { text: `${name} · ${item.feedlabel || "Steam"}` },
    thumbnail: { url: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg` },
  };
}
