import { TokenBank } from "./lib/ingest/string/index.js";
import { RunningStats, trimTokenBank } from "./lib/ingest/string/util.js";
import neo4j, { Driver } from "neo4j-driver";
import dotenv from "dotenv";
import { ingestWikipediaArticle } from "./lib/sources/wikipedia/index.js";

dotenv.config();

// Function to sync token bank with Neo4j
async function syncTokenBankWithNeo4j(driver: Driver, articles: string[]) {
  let memory: TokenBank = new Map();

  for (const article of articles) {
    console.info(`Processing article: ${article}`);

    // Ingest the article and process tokens
    const results = await ingestWikipediaArticle({
      title: article,
      knownTokens: memory,
    });

    const bankProfileStatKeeper = new RunningStats();

    const positionIndex = (() => {
      const index = new Map<number, string>();
      for (const [token, indicesStr] of results.entries()) {
        if (indicesStr.length === 0) {
          // This trims any tokens which only appeared once
          bankProfileStatKeeper.addValue(0);
        } else {
          const indices = indicesStr.split("|").slice(1).map(Number); // slice to remove the empty value at position 0
          bankProfileStatKeeper.addValue(indices.length);
          for (const i of indices) {
            index.set(i, token);
          }
        }
      }
      return index;
    })();

    let adjacentTokenCount = 0;
    (() => {
      for (const currentIndex of Array.from(positionIndex.keys()).sort(
        (a, b) => a - b
      )) {
        const currentToken = positionIndex.get(currentIndex)!;
        const nextTokenIndex = currentIndex + currentToken.length;
        const nextToken = positionIndex.get(nextTokenIndex);
        if (nextToken !== undefined) {
          // store adjacent values
          adjacentTokenCount += 1;
          // console.log(
          //   `${currentIndex} : ${currentToken} -> ${nextTokenIndex} : ${nextToken}`
          // );
        } else {
          // store hanging values
          // console.log(`${index} : ${value}`);
        }
      }
    })();
    console.log(
      "Tokens with adjacency : ",
      String((adjacentTokenCount / positionIndex.size) * 100).slice(0, 5) + "%"
    );

    const bankProfile = {
      meanOccurences: bankProfileStatKeeper.getMean(),
      occuranceVariance: bankProfileStatKeeper.getVariance(),
      STDOfOccurences: bankProfileStatKeeper.getStandardDeviation(),
      singleOccurancePercent:
        String(
          (bankProfileStatKeeper.getNullCount() / results.size) * 100
        ).slice(0, 5) + "%",
      maximumOccurences: bankProfileStatKeeper.getMax(),
    };
    console.log(bankProfile);
  }
}

// Example usage
async function main() {
  const driver = neo4j.driver(
    process.env.NEOURI!,
    neo4j.auth.basic(process.env.NEOUSER!, process.env.NEOPASS!)
  );
  const articles = ["Operator_algebra"];

  try {
    await syncTokenBankWithNeo4j(driver, articles);
  } finally {
    await driver.close();
  }
}

main().catch(console.error);
