export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHANNEL_ID: string;
  RUN_SECRET?: string;
}

export interface Offer {
  id: number;
  title: string;
  link: string;
  offerType: string;
  validity: string;
  body: string;
  imageUrl: string | null;
}

const GCDB_BASE = "https://gcdb.com.au/wp-json/wp/v2";
const ACTIVE_OFFER_STATUS = 207;
const USER_AGENT = "GCDB-Telegram-Bot/1.0";

interface WpOffer {
  id: number;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  featured_media: number;
  "offer-type": number[];
  "offer-status": number[];
  class_list: string[];
  _embedded?: {
    "wp:featuredmedia"?: Array<{
      source_url?: string;
      media_type?: string;
    }>;
  };
}

interface WpTaxonomy {
  id: number;
  name: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`GCDB API error ${response.status}: ${url}`);
  }
  return response.json() as Promise<T>;
}

async function fetchOfferTypes(): Promise<Map<number, string>> {
  const types = await fetchJson<WpTaxonomy[]>(`${GCDB_BASE}/offer-type?per_page=100`);
  return new Map(types.map((t) => [t.id, t.name]));
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—");
}

export function stripHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function extractBody(contentHtml: string): string {
  const paragraphs = contentHtml
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .split(/<\/p>/i)
    .map((chunk) => stripHtml(chunk))
    .filter((text) => text.length > 20);

  return paragraphs.join("\n\n") || stripHtml(contentHtml);
}

function extractImageUrl(offer: WpOffer): string | null {
  const media = offer._embedded?.["wp:featuredmedia"]?.[0];
  if (!media?.source_url || media.media_type !== "image") {
    return null;
  }
  return media.source_url;
}

function parseOffer(offer: WpOffer, typeMap: Map<number, string>): Offer | null {
  const isActive =
    offer["offer-status"]?.includes(ACTIVE_OFFER_STATUS) ||
    offer.class_list?.includes("offer-status-active");

  if (!isActive) {
    return null;
  }

  const typeId = offer["offer-type"]?.[0];
  const offerType = typeId ? typeMap.get(typeId) ?? "Unknown" : "Unknown";

  return {
    id: offer.id,
    title: stripHtml(offer.title.rendered),
    link: offer.link,
    offerType,
    validity: stripHtml(offer.excerpt.rendered),
    body: extractBody(offer.content.rendered),
    imageUrl: offer.featured_media > 0 ? extractImageUrl(offer) : null,
  };
}

export async function fetchActiveOffers(): Promise<Offer[]> {
  const [typeMap, offers] = await Promise.all([
    fetchOfferTypes(),
    fetchJson<WpOffer[]>(
      `${GCDB_BASE}/offer?offer-status=${ACTIVE_OFFER_STATUS}&per_page=100&_embed`,
    ),
  ]);

  return offers
    .map((offer) => parseOffer(offer, typeMap))
    .filter((offer): offer is Offer => offer !== null);
}
