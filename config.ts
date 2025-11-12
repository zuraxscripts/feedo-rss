import type { Item } from "rss-parser";
import { createFeed } from "./src/util.ts";
import { wasSent, markAsSent } from "./src/storage.ts";

export const feeds = [
  createFeed({
    feed: "https://dennikn.sk/feed",
    cron: "* * * * *",
    webhooks: [
      {
        url: process.env.DENNIKN_WEBHOOK,
        payload: (data) => {
          const categories: Record<string, string> = {
            komentare: "1437883640921985035",
            "ficova vlada": "1437883657263124572",
            "robert fico": "1437883671548792873",
            "sudna rada": "1437883697834627102",
            "ustavny sud": "1437883714918154360",
            skolstvo: "1437883729472131174",
            "vojna na ukrajine": "1437883744273961142",
            rusko: "1437883756018012171",
            "vladimir putin": "1437883768638669000",
            mladi: "1437883782257578185",
          };
          const tags: string[] = data.categories
            .map(
              (c) =>
                categories?.[
                  c
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                ]!,
            )
            .filter((c) => c);

          return {
            thread_name:
              data.title.length > 100
                ? `${data.title.slice(0, 97)}...`
                : data.title,
            content: `## ${data.title}\n\n${data.description}\n\n${data.link} <@&1437881478506610828>`,
            applied_tags: tags,
            allowed_mentions: {
              roles: ["1437881478506610828"],
            },
          };
        },
      },
    ],
    fetch: (item: Item) => {
      return {
        title: item.title!,
        description: item.contentSnippet!,
        link: item.link!,
        categories: item.categories!,
      };
    },
    latest: async (item: Item, mark: boolean) => {
      if (await wasSent("dennikn", item.guid!)) {
        return false;
      }

      if (mark) await markAsSent("dennikn", item.guid!);

      return true;
    },
  }),
  createFeed({
    feed: "https://mastodon.social/@zssk_mimoriadne.rss",
    cron: "* * * * *",
    webhooks: [
      {
        url: process.env.ZSSK_MIMORIADNE_WEBHOOK,
        payload: (data) => {
          const allLines = data.description.split("\n").filter(line => line.trim() !== "");
          const lines = allLines.filter(line => !["Vlak", "Meškanie", "Dôvod"].includes(line.trim()));

          const trains = [];
          let currentTrain = null;
          let commonReason = "";
          let commonInfo = "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            const trainMatch = trimmedLine.match(/^((Os|R|Ex|EC|REX|RR|IC)\s+\d+\s*\([^)]+\))/);

            if (trainMatch) {
              if (currentTrain) trains.push(currentTrain);

              currentTrain = {
                trainInfo: trainMatch[1].trim(),
                delayInfo: "",
                reasonInfo: "",
                otherInfo: "",
                isCancelled: false,
                hasDelay: false,
                isInfo: false
              };

              const restOfLine = trimmedLine.substring(trainMatch[0].length).trim();
              if (restOfLine) {
                if (restOfLine.includes("mešká") || restOfLine.includes("predpoklad") || restOfLine.includes("odrieknutý")) {
                  currentTrain.delayInfo = restOfLine;
                  if (restOfLine.includes("odrieknutý")) currentTrain.isCancelled = true;
                  else currentTrain.hasDelay = true;
                } else {
                  currentTrain.otherInfo = restOfLine;
                  currentTrain.isInfo = true;
                }
              }
            } else if (currentTrain) {
              if ((trimmedLine.includes("mešká") || trimmedLine.includes("predpoklad") || trimmedLine.includes("odrieknutý")) && !currentTrain.delayInfo) {
                currentTrain.delayInfo = trimmedLine;
                if (trimmedLine.includes("odrieknutý")) currentTrain.isCancelled = true;
                else currentTrain.hasDelay = true;
              } else if ((trimmedLine.includes("mešká pre") || trimmedLine.includes("V dôsledku")) && !currentTrain.reasonInfo) {
                currentTrain.reasonInfo = trimmedLine;
              } else if (!currentTrain.otherInfo) {
                currentTrain.otherInfo = trimmedLine;
                if (!currentTrain.hasDelay && !currentTrain.isCancelled) currentTrain.isInfo = true;
              }
            } else {
              if (trimmedLine.includes("mešká pre") || trimmedLine.includes("V dôsledku")) commonReason = trimmedLine;
              else commonInfo = trimmedLine;
            }
          }

          if (currentTrain) trains.push(currentTrain);
          if (trains.length === 0) return null;

          const embeds = [];

          for (const train of trains) {
            if (commonReason && !train.reasonInfo) train.reasonInfo = commonReason;
            if (commonInfo && !train.otherInfo) {
              train.otherInfo = commonInfo;
              if (!train.hasDelay && !train.isCancelled) train.isInfo = true;
            }

            let embedColor;
            let embedTitle;

            if (train.isCancelled) {
              embedColor = 0xFF0000;
              embedTitle = "🔴 Zrušený vlak ZSSK";
            } else if (train.hasDelay) {
              embedColor = 0xFFA500;
              embedTitle = "🟠 Meškanie ZSSK";
            } else {
              embedColor = 0x1DA1F2;
              embedTitle = "🔔 Informácia ZSSK";
            }

            const fields = [];

            if (train.trainInfo) fields.push({ name: "🚂 Vlak", value: `**${train.trainInfo}**`, inline: false });

            if (train.delayInfo) {
              let formattedDelay = train.delayInfo;
              const delayMatch = train.delayInfo.match(/(\d+)\s*minút/);
              if (delayMatch) formattedDelay = train.delayInfo.replace(/(\d+)\s*minút/, `**${delayMatch[1]} minút**`);
              fields.push({ name: "⏰ Meškanie", value: formattedDelay, inline: false });
            }

            if (train.reasonInfo) fields.push({ name: "📋 Dôvod", value: `*${train.reasonInfo}*`, inline: false });
            if (train.otherInfo) fields.push({ name: "ℹ️ Informácia", value: `> ${train.otherInfo}`, inline: false });

            if (fields.length > 0) {
              embeds.push({
                title: embedTitle,
                color: embedColor,
                url: data.link,
                fields: fields,
                footer: { text: "Mastodon RSS Feed" },
                timestamp: new Date().toISOString(),
              });
            }
          }

          if (embeds.length === 0) return null;

          return {
            embeds: embeds,
            content: "<@&1437202276392501369>",
            allowed_mentions: { roles: ["1437202276392501369"] },
          };
        },
      },
    ],
    fetch: (item: Item) => {
      const relevantKeywords = [
        "vlak", "mešká", "odrieknutý", "Os ", "R ", "Ex ", "IC ", "EC ", "REX ", 
        "upozorňujeme cestujúcich", "reštauračný vozeň", "výluka"
      ];

      const isTrainInfo = relevantKeywords.some(keyword => 
        item.contentSnippet?.toLowerCase().includes(keyword.toLowerCase())
      );

      if (!isTrainInfo) return null;

      return {
        description: item.contentSnippet,
        link: item.link,
      };
    },
    latest: async (item: Item, mark: boolean) => {
      if (await wasSent("zssk", item.guid!)) return false;
      if (mark) await markAsSent("zssk", item.guid!);
      return true;
    },
  })
];
