# game-news-bot

Posts **Steam news / patch notes** and **Epic free games** to a Discord channel
through a webhook. No bot account, no gateway, just a small process that polls on
an interval and posts when something is new.

## How it works

- Every `POLL_MINUTES`, it fetches:
  - Steam news (`ISteamNews/GetNewsForApp`, public, no key) for each game in
    `watchlist.json` — **official announcements / patch notes only** by default
    (set `"steamIncludePress": true` to also include gaming-press articles), and
  - the current Epic free games (the public promotions feed).
- It diffs against `data/state.json` so each item posts **once**. After the first
  run it posts only genuinely new items.
- **On a fresh deploy** it posts a one-time "online" confirmation plus the latest
  post for each tracked game, so you can immediately see it working.
- Updates go out as Discord embeds (game image, title, link, timestamp).

## Setup

1. **Make a webhook** in Discord: target channel → *Edit Channel → Integrations →
   Webhooks → New Webhook → Copy Webhook URL*.
2. Copy the env file and paste the URL:
   ```sh
   cp .env.example .env
   # set DISCORD_WEBHOOK_URL=...
   ```
3. **Pick your Steam games** in `watchlist.json`. The `appid` is the number in a
   game's store URL: `store.steampowered.com/app/<appid>/...`. Set
   `"epicFreeGames": false` if you don't want the Epic free-game posts.

## Run it

Dry run (prints what it *would* post, sends nothing, no webhook needed):
```sh
npm install
npm run dry
```

Locally for real:
```sh
npm install
npm start
```

With Docker (recommended for the VPS, mounts a volume so state persists):
```sh
docker build -t game-news-bot .
docker run -d --name game-news-bot \
  --env-file .env \
  -v "$PWD/data:/app/data" \
  --restart unless-stopped \
  game-news-bot
```

Or as a compose service alongside other bots:
```yaml
services:
  game-news-bot:
    build: .
    env_file: .env
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

## Config reference

| Where | Key | Meaning |
| --- | --- | --- |
| `.env` | `DISCORD_WEBHOOK_URL` | Target channel webhook (required). |
| `.env` | `POLL_MINUTES` | Poll interval, minutes (min 5, default 30). |
| `.env` | `DRY_RUN` | `1` = print instead of post. |
| `watchlist.json` | `steam[]` | `{ "appid": number, "name": string }` per game. |
| `watchlist.json` | `steamIncludePress` | `false` (default) = official posts only; `true` = include press. |
| `watchlist.json` | `epicFreeGames` | `true`/`false` to toggle Epic free-game posts. |

## Notes / extending

- Steam patch notes come through the same news feed, so they're already covered.
- To also track **price drops** later, the cleanest add is the IsThereAnyDeal API
  (covers Steam + Epic in one place); drop a `src/deals.ts` next to the others.
- State is a plain JSON file; delete `data/state.json` to re-seed from scratch.
