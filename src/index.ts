import { read } from "./lib/ingest/string/index.js";
import neo4j, { Driver } from "neo4j-driver";
import dotenv from "dotenv";
import chalk from "chalk";
import { getSource, Source, SourceType } from "./lib/sources/index.js";
import { randomUUID } from "crypto";
import { limitedBatchProcessor } from "./lib/util/limitedBatchProcessor.js";
import { TokenBank } from "./lib/util/tokenBank.js";
import { trim } from "./lib/util/trim.js";

dotenv.config();

async function processSources(driver: Driver, sources: Source[]) {
  let memory: TokenBank = new Map();

  const results = await limitedBatchProcessor(
    sources.map((source) =>
      getSource(source, randomUUID()).then(({ content, runId }) =>
        content ? read(content!, memory, runId) : { parsed: undefined, runId }
      )
    ),
    5,
    () => trim(memory)
  );

  process.env.VERBOSE &&
    console.log(
      chalk.magentaBright("[MEMORY SIZE]", chalk.white(memory.size + "tkns"))
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
    // { type: SourceType.wiki, identifier: "API" },
    // { type: SourceType.doc, identifier: "./package-lock.json" },
    // { type: SourceType.doc, identifier: "./package.json" },
    // { type: SourceType.doc, identifier: "./tsconfig.json" },
  ];

  try {
    const { results, memory } = await processSources(driver, sources);
  } finally {
    await driver.close();
  }
}

main().catch(console.error);
