import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type Watch = { appid: number; name?: string };
export type Config = {
  webhookUrl: string;
  pollMinutes: number;
  stateFile: string;
  steam: Watch[];
  steamIncludePress: boolean; // false = official Steam announcements only
  epicFreeGames: boolean;
  dryRun: boolean;
};

// Minimal .env loader so local runs don't need anything fancy. Only fills keys
// that aren't already set in the real environment (so Docker env wins).
function loadDotEnv(): void {
  const path = resolve(".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const [, key, rawValue] = m;
    if (key && process.env[key] === undefined) {
      process.env[key] = rawValue?.replace(/^["']|["']$/g, "") ?? "";
    }
  }
}

export function loadConfig(): Config {
  loadDotEnv();

  const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
  const webhookUrl = (process.env.DISCORD_WEBHOOK_URL ?? "").trim();
  if (!webhookUrl && !dryRun) {
    throw new Error("DISCORD_WEBHOOK_URL is required (set it in .env, or run with DRY_RUN=1).");
  }

  const pollMinutes = Math.max(5, Number(process.env.POLL_MINUTES) || 30);
  const stateFile = (process.env.STATE_FILE ?? "").trim() || resolve("data/state.json");
  const watchPath = (process.env.WATCHLIST_FILE ?? "").trim() || resolve("watchlist.json");

  let steam: Watch[] = [];
  let epicFreeGames = true;
  let steamIncludePress = false;
  try {
    const raw = JSON.parse(readFileSync(watchPath, "utf8")) as {
      steam?: Watch[];
      epicFreeGames?: boolean;
      steamIncludePress?: boolean;
    };
    steam = (raw.steam ?? []).filter((w) => Number.isFinite(w.appid));
    if (typeof raw.epicFreeGames === "boolean") epicFreeGames = raw.epicFreeGames;
    if (typeof raw.steamIncludePress === "boolean") steamIncludePress = raw.steamIncludePress;
  } catch {
    console.warn(`[config] could not read ${watchPath}; no Steam games will be tracked.`);
  }

  return { webhookUrl, pollMinutes, stateFile, steam, steamIncludePress, epicFreeGames, dryRun };
}
