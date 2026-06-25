import type { Embed } from "./discord.js";

const EPIC_FREE_URL =
  "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions" +
  "?locale=en-US&country=US&allowCountries=US";
const EPIC_COLOR = 0x2f2d2e;

type Img = { type: string; url: string };
type Offer = { startDate: string; endDate: string; discountSetting: { discountPercentage: number } };
type Element = {
  title: string;
  id: string;
  productSlug?: string | null;
  urlSlug?: string;
  keyImages?: Img[];
  offerMappings?: { pageSlug?: string }[];
  catalogNs?: { mappings?: { pageSlug?: string }[] };
  price?: { totalPrice?: { discountPrice?: number } };
  promotions?: { promotionalOffers?: { promotionalOffers?: Offer[] }[] } | null;
};

export type FreeGame = { id: string; title: string; url: string; image?: string; endDate?: string };

// The free-games promo feed (the canonical source every "Epic free game" bot uses).
export async function fetchEpicFreeGames(): Promise<FreeGame[]> {
  const res = await fetch(EPIC_FREE_URL, { headers: { "user-agent": "game-news-bot" } });
  if (!res.ok) throw new Error(`Epic free games: HTTP ${res.status}`);
  const data = (await res.json()) as {
    data?: { Catalog?: { searchStore?: { elements?: Element[] } } };
  };
  const elements = data.data?.Catalog?.searchStore?.elements ?? [];
  const now = Date.now();
  const free: FreeGame[] = [];

  for (const e of elements) {
    const offers = e.promotions?.promotionalOffers?.[0]?.promotionalOffers ?? [];
    const active = offers.find(
      (o) =>
        o.discountSetting?.discountPercentage === 0 &&
        Date.parse(o.startDate) <= now &&
        now < Date.parse(o.endDate),
    );
    if (!active) continue;
    if ((e.price?.totalPrice?.discountPrice ?? -1) !== 0) continue; // genuinely $0 right now

    free.push({
      id: e.id,
      title: e.title,
      url: epicUrl(e),
      image: pickImage(e.keyImages),
      endDate: active.endDate,
    });
  }
  return free;
}

// Epic's store path is messy; try the slugs in order of reliability, else the hub.
function epicUrl(e: Element): string {
  const slug =
    e.offerMappings?.[0]?.pageSlug ||
    e.catalogNs?.mappings?.[0]?.pageSlug ||
    e.productSlug ||
    e.urlSlug;
  return slug
    ? `https://store.epicgames.com/en-US/p/${slug.replace(/\/home$/, "")}`
    : "https://store.epicgames.com/en-US/free-games";
}

function pickImage(imgs?: Img[]): string | undefined {
  if (!imgs?.length) return undefined;
  const order = ["OfferImageWide", "DieselStoreFrontWide", "featuredMedia", "Thumbnail"];
  for (const type of order) {
    const hit = imgs.find((i) => i.type === type);
    if (hit) return hit.url;
  }
  return imgs[0]?.url;
}

export function epicEmbed(g: FreeGame): Embed {
  const until = g.endDate ? `<t:${Math.floor(Date.parse(g.endDate) / 1000)}:R>` : "soon";
  return {
    title: `Free on Epic: ${g.title}`.slice(0, 256),
    url: g.url,
    description: `Free to keep, claim it before it ends (${until}).`,
    color: EPIC_COLOR,
    footer: { text: "Epic Games Store" },
    ...(g.image ? { image: { url: g.image } } : {}),
  };
}
