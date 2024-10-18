import { read, ReadResponse, decode } from "./lib/ingest/string/index.js";
import neo4j, { Driver, Neo4jError } from "neo4j-driver";
import dotenv from "dotenv";
import { getSource, Source, SourceType } from "./lib/sources/index.js";
import { randomUUID } from "crypto";
import { limitedBatchProcessor } from "./util/limitedBatchProcessor.js";
import { sync } from "./util/sync.js";
import {
  AdjacencyList,
  buildAdjacencyList,
} from "./util/buildAdjacencyList.js";
import { trim } from "./util/trim.js";
import { getTopTkns } from "./lib/neo4j/gds/getTopTokens.js";
import chalk from "chalk";
import { withTimer } from "./util/withTimer.js";
import { writeFileSync } from "fs";
// import { writeFileSync } from "fs";

dotenv.config();

async function push(batchResults: ReadResponse[], driver: Driver) {
  let mergedAdjacencyList: AdjacencyList = new Map();
  batchResults.forEach(({ parsed, runId }) => {
    if (!parsed) return;

    const adjacencyList = buildAdjacencyList(parsed, runId);
    trim(adjacencyList, undefined, runId);
    if (mergedAdjacencyList.size === 0) {
      mergedAdjacencyList = adjacencyList;
    } else {
      adjacencyList.forEach((pTkns, tkn) => {
        let pTknsToSet = mergedAdjacencyList.get(tkn);
        if (pTknsToSet) {
          pTknsToSet = [...pTknsToSet, ...pTkns];
        } else {
          pTknsToSet = pTkns;
        }

        mergedAdjacencyList.set(tkn, pTknsToSet);
      });
    }
  });
  await sync(mergedAdjacencyList, driver, randomUUID(), 200);
}

async function readSources(driver: Driver, sources: Source[]) {
  const topTkns = await getTopTkns(driver, 0.2).catch((err: Neo4jError) => {
    console.error(
      chalk.yellowBright("[GETTING TOP TKNS]") +
        chalk.red("[FAIL]") +
        chalk.white(err.code)
    );
    return undefined;
  });
  let memory: Set<string> = new Set(topTkns || []);

  const results = await limitedBatchProcessor(
    sources.map((source) =>
      getSource(source, randomUUID()).then(({ content, runId }) => {
        if (content) {
          const timedRead = withTimer(() => read(content!, memory, runId));
          const { result, duration } = timedRead();
          console.log(
            chalk.yellowBright("[PARSING]") +
              chalk.blueBright(`[${runId}]`) +
              chalk.magentaBright("[PARSED]") +
              chalk.white(
                result.opct +
                  " ops | " +
                  String(
                    Math.round((result.opct / duration / duration) * 10000) /
                      10000
                  ) +
                  " ops/ms"
              )
          );
          return result;
        } else {
          return { parsed: undefined, runId, opct: 0 };
        }
      })
    ),
    5,
    async (batchResults) => {
      if (!batchResults) return;
      await push(batchResults, driver);
    }
  );

  return { results, memory };
}

async function main() {
  const driver = neo4j.driver(
    process.env.NEOURI!,
    neo4j.auth.basic(process.env.NEOUSER!, process.env.NEOPASS!)
  );

  const sources: Source[] = [
    { type: SourceType.wiki, identifier: "Operator_algebra" },
    { type: SourceType.wiki, identifier: "API" },
    { type: SourceType.wiki, identifier: "Zach_Garrett" },
    { type: SourceType.wiki, identifier: "Archery" },
    { type: SourceType.wiki, identifier: "Art" },
    // { type: SourceType.doc, identifier: "./package-lock.json" },
    // { type: SourceType.doc, identifier: "./package.json" },
    // { type: SourceType.doc, identifier: "./tsconfig.json" },
  ];

  try {
    const res = await readSources(driver, sources);
  } finally {
    await driver.close();
  }
}

main().catch(console.error);
