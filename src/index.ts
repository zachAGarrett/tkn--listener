import { read, ReadResponse } from "./lib/ingest/string/index.js";
import neo4j, { Driver } from "neo4j-driver";
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
  const topTkns = await getTopTkns(driver, 0.2);
  console.log(topTkns);
  let memory: Set<string> = new Set(topTkns.map(({ tkn }) => tkn));

  const results = await limitedBatchProcessor(
    sources.map((source) =>
      getSource(source, randomUUID()).then(({ content, runId }) =>
        content ? read(content!, memory, runId) : { parsed: undefined, runId }
      )
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
    // { type: SourceType.doc, identifier: "./package-lock.json" },
    // { type: SourceType.doc, identifier: "./package.json" },
    // { type: SourceType.doc, identifier: "./tsconfig.json" },
  ];

  try {
    const { results, memory } = await readSources(driver, sources);
  } finally {
    await driver.close();
  }
}

main().catch(console.error);
