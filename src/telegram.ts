import type { Offer } from "./gcdb";

const PHOTO_CAPTION_LIMIT = 1024;
const MESSAGE_LIMIT = 4096;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function formatOfferMessage(offer: Offer, hasPhoto: boolean): string {
  const limit = hasPhoto ? PHOTO_CAPTION_LIMIT : MESSAGE_LIMIT;

  const title = `<b>${escapeHtml(offer.title)}</b>`;
  const meta: string[] = [];

  if (offer.offerType) {
    meta.push(`类型: ${escapeHtml(offer.offerType)}`);
  }

  if (offer.validity) {
    meta.push(`有效期: ${escapeHtml(offer.validity)}`);
  }

  const footer = `<a href="${escapeHtml(offer.link)}">查看详情</a>`;
  const body = offer.body ? escapeHtml(offer.body) : "";

  const sections: string[] = [title];

  if (meta.length > 0) {
    sections.push("", ...meta);
  }

  if (body) {
    sections.push("", body);
  }

  sections.push("", footer);

  let message = sections.join("\n");
  if (message.length <= limit) {
    return message;
  }

  if (!body) {
    return message.slice(0, limit);
  }

  const withoutBody = [title];
  if (meta.length > 0) {
    withoutBody.push("", ...meta);
  }
  withoutBody.push("", footer);

  const fixedLength = withoutBody.join("\n").length + 2;
  const bodyBudget = limit - fixedLength;

  if (bodyBudget <= 1) {
    return withoutBody.join("\n").slice(0, limit);
  }

  const truncatedBody = `${body.slice(0, bodyBudget - 1)}…`;
  const rebuilt = [title];
  if (meta.length > 0) {
    rebuilt.push("", ...meta);
  }
  rebuilt.push("", truncatedBody, "", footer);

  return rebuilt.join("\n");
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
