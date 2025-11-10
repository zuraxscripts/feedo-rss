import type Parser from "rss-parser";
import type { Feed } from "./util.js";

export async function processFeed<T>(feed: Feed<T>, parser: Parser) {
  try {
    const rss = await parser.parseURL(feed.feed);

    if (!rss.items || rss.items.length === 0) {
      return;
    }

    const sortedItems = [...rss.items].sort((a, b) => {
      const dateA = new Date(a.pubDate || 0).getTime();
      const dateB = new Date(b.pubDate || 0).getTime();
      return dateA - dateB;
    });

    const latestItem = sortedItems[sortedItems.length - 1]!;
    if (!((await feed.latest?.(latestItem, false)) ?? true)) {
      console.log("Latest item already processed, skipping feed");

      return;
    }

    let firstNewIndex = -1;

    for (let i = sortedItems.length - 1; i >= 0; i--) {
      const item = sortedItems[i]!;
      const isNew = (await feed.latest?.(item, false)) ?? true;

      if (isNew) {
        firstNewIndex = i;
      } else {
        break;
      }
    }

    if (firstNewIndex === -1) {
      console.log("No new items found");
      return;
    }

    const newItems = sortedItems.slice(firstNewIndex);

    console.log(`Processing ${newItems.length} new items`);

    for (const item of newItems) {
      const data = feed.fetch(item);

      await Promise.allSettled(
        feed.webhooks
          .filter((webhook) => webhook.url)
          .map((webhook) => sendWebhook(webhook.url!, webhook.payload(data))),
      );
    }

    await feed.latest?.(newItems[newItems.length - 1]!, true);
  } catch (error) {
    console.error(`Error processing feed ${feed.feed}:`, error);
  }
}

async function sendWebhook(url: string, payload: any) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status}`);
    }
  } catch (error) {
    console.error(`Webhook error for ${url}:`, error);
  }
}
