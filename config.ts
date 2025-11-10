import type { Item } from "rss-parser";
import { createFeed } from "./src/util.ts";
import { wasSent, markAsSent } from "./src/storage.ts";

export const feeds = [
  createFeed({
    feed: "https://mastodon.social/@zssk_mimoriadne.rss",
    cron: "* * * * *",
    webhooks: [
      {
        url: process.env.ZSSK_MIMORIADNE_WEBHOOK,
        payload: (data) => ({
          content: `${data.description}\n\n${data.link} <@&1437202276392501369>`,
        }),
      },
    ],
    fetch: (item: Item) => ({
      description: item.contentSnippet,
      link: item.link,
    }),
    latest: async (item: Item, mark: boolean) => {
      if (await wasSent("zssk", item.guid!)) {
        return false;
      }

      if (mark) await markAsSent("zssk", item.guid!);

      return true;
    },
  }),
];
