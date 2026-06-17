import type { Offer } from "./gcdb";

export async function getSentOfferIds(db: D1Database, offerIds: number[]): Promise<Set<number>> {
  if (offerIds.length === 0) {
    return new Set();
  }

  const placeholders = offerIds.map(() => "?").join(", ");
  const result = await db
    .prepare(`SELECT offer_id FROM sent_offers WHERE offer_id IN (${placeholders})`)
    .bind(...offerIds)
    .all<{ offer_id: number }>();

  return new Set((result.results ?? []).map((row) => row.offer_id));
}

export async function markOfferSent(db: D1Database, offer: Offer): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sent_offers (offer_id, title, link, offer_type, validity)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(offer.id, offer.title, offer.link, offer.offerType, offer.validity)
    .run();
}

export async function filterNewOffers(db: D1Database, offers: Offer[]): Promise<Offer[]> {
  const sentIds = await getSentOfferIds(
    db,
    offers.map((offer) => offer.id),
  );
  return offers.filter((offer) => !sentIds.has(offer.id));
}
