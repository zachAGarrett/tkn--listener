import { ingest, TokenBank } from "./lib/ingest/string/index.js";
import neo4j, { Driver } from "neo4j-driver";
import dotenv from "dotenv";
import { getWikipediaArticle } from "./lib/sources/wikipedia/getArticle.js";
import { randomUUID } from "crypto";
import chalk from "chalk";
import pLimit from "p-limit";

const limit = pLimit(4);

dotenv.config();

async function processArticles(driver: Driver, articles: string[]) {
  let memory: TokenBank = new Map();

  const runs = articles.map(async (article) =>
    limit(() =>
      getWikipediaArticle(article, randomUUID()).then(
        ({ runId, content: corpus }) => {
          const runIdLog = chalk.blueBright(`[${runId}]`);
          const { bank, newTokenCount, parsed, driftDeltas } = ingest(
            corpus,
            memory,
            runId
          );

          // process.env.VERBOSE &&
          //   console.log(
          //     runIdLog +
          //       chalk.magentaBright("[CENTROIDS]") +
          //       ": " +
          //       chalk.white(driftDeltas)
          //   );
          process.env.VERBOSE &&
            console.log(
              runIdLog +
                chalk.magentaBright("[TOKENS]") +
                ": " +
                chalk.white(
                  `${newTokenCount} new TKNS from ${
                    parsed.join("").length
                  } CHARS`
                )
            );

          return { bank, newTokenCount, parsed, runId };
        }
      )
    )
  );

  return await Promise.all(runs);
}

async function main() {
  const driver = neo4j.driver(
    process.env.NEOURI!,
    neo4j.auth.basic(process.env.NEOUSER!, process.env.NEOPASS!)
  );
  const articles = [
    "Operator_algebra",
    //  "API",
    // "Zach_Garrett"
  ];

  try {
    await processArticles(driver, articles);
  } finally {
    await driver.close();
  }
}

main().catch(console.error);
