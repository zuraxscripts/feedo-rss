import type { Item } from "rss-parser";

export interface Webhook<T> {
  url: string | undefined;
  payload: (data: T) => any;
}

export interface Feed<T> {
  feed: string;
  cron: string;
  webhooks: Webhook<T>[];
  fetch: (item: Item) => T;
  latest?: (item: Item, mark: boolean) => Promise<boolean> | boolean;
}

export function createFeed<T>(config: Feed<T>): Feed<T> {
  return config;
}
