import type { Offer } from "./gcdb";

const PHOTO_CAPTION_LIMIT = 1024;
const MESSAGE_LIMIT = 4096;
const BLOCKQUOTE_OPEN = "<blockquote>";
const BLOCKQUOTE_CLOSE = "</blockquote>";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatQuotedBody(body: string): string {
  return `${BLOCKQUOTE_OPEN}${body}${BLOCKQUOTE_CLOSE}`;
}

function buildFixedParts(offer: Offer): { header: string; footer: string } {
  const lines = [`<b>${escapeHtml(offer.title)}</b>`];

  if (offer.offerType) {
    lines.push(`Type: ${escapeHtml(offer.offerType)}`);
  }

  if (offer.validity) {
    lines.push(`Valid: ${escapeHtml(offer.validity)}`);
  }

  return {
    header: lines.join("\n"),
    footer: `<a href="${escapeHtml(offer.link)}">View details</a>`,
  };
}

function assembleMessage(header: string, body: string | null, footer: string): string {
  const parts = [header];

  if (body) {
    parts.push("", formatQuotedBody(body));
  }

  parts.push("", footer);
  return parts.join("\n");
}

export function formatOfferMessage(offer: Offer, hasPhoto: boolean): string {
  const limit = hasPhoto ? PHOTO_CAPTION_LIMIT : MESSAGE_LIMIT;
  const { header, footer } = buildFixedParts(offer);
  const rawBody = offer.body ? escapeHtml(offer.body) : "";

  if (!rawBody) {
    return assembleMessage(header, null, footer);
  }

  let message = assembleMessage(header, rawBody, footer);
  if (message.length <= limit) {
    return message;
  }

  const overhead =
    header.length + footer.length + BLOCKQUOTE_OPEN.length + BLOCKQUOTE_CLOSE.length + 2;
  const bodyBudget = limit - overhead;

  if (bodyBudget <= 1) {
    return assembleMessage(header, null, footer);
  }

  const truncatedBody = `${rawBody.slice(0, bodyBudget - 1)}…`;
  return assembleMessage(header, truncatedBody, footer);
}

interface TelegramResponse {
  ok: boolean;
  description?: string;
}

async function callTelegramApi(
  token: string,
  method: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const result = (await response.json()) as TelegramResponse;
  if (!response.ok || !result.ok) {
    throw new Error(result.description ?? `Telegram API error: ${response.status}`);
  }
}

export async function sendOffer(
  token: string,
  channelId: string,
  offer: Offer,
): Promise<void> {
  const hasPhoto = Boolean(offer.imageUrl);
  const text = formatOfferMessage(offer, hasPhoto);

  if (hasPhoto && offer.imageUrl) {
    await callTelegramApi(token, "sendPhoto", {
      chat_id: channelId,
      photo: offer.imageUrl,
      caption: text,
      parse_mode: "HTML",
    });
    return;
  }

  await callTelegramApi(token, "sendMessage", {
    chat_id: channelId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: false,
  });
}
