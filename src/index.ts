import { filterNewOffers, markOfferSent } from "./db";
import { fetchActiveOffers } from "./gcdb";
import type { Env } from "./gcdb";
import { listRecentChats, sendOffer } from "./telegram";

interface SyncResult {
  checked: number;
  new: number;
  sent: number;
  errors: string[];
}

async function syncOffers(env: Env): Promise<SyncResult> {
  const offers = await fetchActiveOffers();
  const newOffers = await filterNewOffers(env.DB, offers);

  const result: SyncResult = {
    checked: offers.length,
    new: newOffers.length,
    sent: 0,
    errors: [],
  };

  for (const offer of newOffers) {
    try {
      await sendOffer(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, offer);
      await markOfferSent(env.DB, offer);
      result.sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Offer ${offer.id}: ${message}`);
      console.error(`Failed to send offer ${offer.id}:`, message);
    }
  }

  return result;
}

function isAuthorized(request: Request, env: Env): boolean {
  if (!env.RUN_SECRET) {
    return true;
  }

  const authHeader = request.headers.get("Authorization");
  return authHeader === `Bearer ${env.RUN_SECRET}`;
}

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    const result = await syncOffers(env);
    console.log("Scheduled sync complete:", JSON.stringify(result));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/run" && request.method === "GET") {
      if (!isAuthorized(request, env)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      try {
        const result = await syncOffers(env);
        return Response.json(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return Response.json({ error: message }, { status: 500 });
      }
    }

    if (url.pathname === "/chats" && request.method === "GET") {
      if (!isAuthorized(request, env)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      try {
        const chats = await listRecentChats(env.TELEGRAM_BOT_TOKEN);
        return Response.json({ chats });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return Response.json({ error: message }, { status: 500 });
      }
    }

    if (url.pathname === "/" && request.method === "GET") {
      return Response.json({
        service: "gcdb-telegram",
        endpoints: {
          run: "GET /run",
          chats: "GET /chats",
        },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
