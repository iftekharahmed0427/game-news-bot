import { loadConfig, type Config } from "./config.js";
import { loadState, saveState, type State } from "./state.js";
import { postEmbeds, type Embed } from "./discord.js";
import { fetchSteamNews, steamEmbed } from "./steam.js";
import { fetchEpicFreeGames, epicEmbed } from "./epic.js";

const SEEN_CAP = 60; // how many news gids to remember per game

// Steam: collect news items we haven't seen. On the very first run for a game we
// seed silently (record current items, post nothing) so we don't dump history.
async function checkSteam(cfg: Config, state: State): Promise<Embed[]> {
  const out: Embed[] = [];
  for (const w of cfg.steam) {
    const key = String(w.appid);
    let items;
    try {
      items = await fetchSteamNews(w.appid, cfg.steamIncludePress);
    } catch (e) {
      console.error(`[steam] ${key}: ${(e as Error).message}`);
      continue;
    }
    const name = w.name || `App ${w.appid}`;
    const seen = new Set(state.steamSeen[key] ?? []);
    if (!state.steamSeeded[key]) {
      state.steamSeeded[key] = true;
      // First run: post just the latest item so a fresh deploy shows real content
      // immediately, then mark the rest seen (no history dump).
      const latest = items[0];
      if (latest) out.push(steamEmbed(w.appid, name, latest));
    } else {
      // Oldest-first so the channel reads chronologically.
      for (const item of items.filter((i) => !seen.has(i.gid)).reverse()) {
        out.push(steamEmbed(w.appid, name, item));
      }
    }
    const merged = [...items.map((i) => i.gid), ...(state.steamSeen[key] ?? [])];
    state.steamSeen[key] = [...new Set(merged)].slice(0, SEEN_CAP);
  }
  return out;
}

// Epic: post any currently-free game we haven't announced yet.
async function checkEpic(cfg: Config, state: State): Promise<Embed[]> {
  if (!cfg.epicFreeGames) return [];
  let games;
  try {
    games = await fetchEpicFreeGames();
  } catch (e) {
    console.error(`[epic] ${(e as Error).message}`);
    return [];
  }
  const posted = new Set(state.epicPosted);
  const out = games.filter((g) => !posted.has(g.id)).map(epicEmbed);
  // Keep current ids marked (so we don't repost while still free) and cap growth.
  state.epicPosted = [...new Set([...games.map((g) => g.id), ...state.epicPosted])].slice(0, 50);
  return out;
}

// One-time "online" confirmation so a fresh deploy visibly reports in.
function startupEmbed(cfg: Config): Embed {
  const watching = [`${cfg.steam.length} Steam game(s) for official updates`];
  if (cfg.epicFreeGames) watching.push("Epic free games");
  return {
    title: "game-news-bot is online",
    description: `Watching ${watching.join(" and ")}. New posts will appear here.`,
    color: 0x57f287,
  };
}

async function tick(cfg: Config): Promise<void> {
  const state = loadState(cfg.stateFile);
  const embeds: Embed[] = [];
  if (!state.started) {
    embeds.push(startupEmbed(cfg));
    state.started = true;
  }
  embeds.push(...(await checkSteam(cfg, state)), ...(await checkEpic(cfg, state)));
  if (embeds.length) {
    console.log(`[post] ${embeds.length} update(s)`);
    await postEmbeds(cfg.webhookUrl, embeds, cfg.dryRun);
  } else {
    console.log("[tick] nothing new");
  }
  saveState(cfg.stateFile, state);
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  console.log(
    `[start] ${cfg.steam.length} Steam game(s), epic=${cfg.epicFreeGames}, ` +
      `every ${cfg.pollMinutes}m${cfg.dryRun ? " (DRY RUN)" : ""}`,
  );
  const run = () => tick(cfg).catch((e) => console.error("[tick]", e));
  await run();
  // RUN_ONCE=1 does a single pass and exits (handy for testing or a system cron);
  // otherwise it keeps polling on the interval.
  if (process.env.RUN_ONCE === "1" || process.env.RUN_ONCE === "true") return;
  setInterval(run, cfg.pollMinutes * 60_000);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
