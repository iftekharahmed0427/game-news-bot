export type Embed = {
  title: string;
  url?: string;
  description?: string;
  color?: number;
  timestamp?: string;
  footer?: { text: string };
  thumbnail?: { url: string };
  image?: { url: string };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Post embeds to a Discord webhook, 10 at a time (Discord's per-message cap),
// honouring rate-limit (429) backoff. In dry-run mode it just prints them.
export async function postEmbeds(webhookUrl: string, embeds: Embed[], dryRun: boolean): Promise<void> {
  if (embeds.length === 0) return;
  if (dryRun) {
    for (const e of embeds) console.log(`[dry] would post: ${e.title}${e.url ? ` -> ${e.url}` : ""}`);
    return;
  }
  for (let i = 0; i < embeds.length; i += 10) {
    await send(webhookUrl, { embeds: embeds.slice(i, i + 10) });
    await sleep(400); // be gentle between batches
  }
}

async function send(webhookUrl: string, body: unknown, attempt = 0): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429 && attempt < 3) {
    const retryAfter = Number(res.headers.get("retry-after")) || 1;
    await sleep((retryAfter + 0.5) * 1000);
    return send(webhookUrl, body, attempt + 1);
  }
  if (!res.ok && res.status !== 204) {
    throw new Error(`Discord webhook ${res.status}: ${await res.text().catch(() => "")}`);
  }
}
