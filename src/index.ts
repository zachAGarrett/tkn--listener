import { ingest, TokenBank } from "./lib/ingest/string/index.js";
import neo4j, { Driver } from "neo4j-driver";
import dotenv from "dotenv";
import { getWikipediaArticle } from "./lib/sources/wikipedia/getArticle.js";
import { randomUUID } from "crypto";
import chalk from "chalk";
import pLimit from "p-limit";
import { createDriftDeltasChart } from "./dev_util/outputChart.js";
import { getDocument } from "./lib/sources/fs/getDocument.js";

export enum SourceType {
  wiki = "WIKI",
  doc = "DOC",
}
export interface Source {
  type: SourceType;
  identifier: string;
}

const limit = pLimit(4);

dotenv.config();

async function getSource({ type, identifier }: Source) {
  const runId = randomUUID();
  let res: Promise<{
    runId: string;
    content: string;
  }>;
  try {
    switch (type) {
      case SourceType.wiki:
        res = getWikipediaArticle(identifier, runId);
        break;
      case SourceType.doc:
        res = getDocument(identifier, runId);
        break;

      default:
        throw new Error(chalk.red("Unrecognized source type", "\n" + type));
    }
    return await res;
  } catch (error) {
    console.error(error);
  }
}

async function processSources(driver: Driver, sources: Source[]) {
  let memory: TokenBank = new Map();

  const runs = sources.map(async (source, i) =>
    limit(() =>
      getSource(source).then(async (res) => {
        if (!res) {
          return;
        }

        const { runId, content: corpus } = res;
        const runIdLog = chalk.blueBright(`[${runId}]`);
        const { bank, newTokenCount, chunks, driftDeltas } = ingest(
          corpus,
          memory,
          runId
        );

        await createDriftDeltasChart(
          driftDeltas,
          "/Users/zach/Downloads/" + i + "_" + runId + "_drift_deltas.png"
        );

        chunks.map((chunk, i) =>
          console.log(chalk.magentaBright("CHUNK" + i + ":"), chunk)
        );

        process.env.VERBOSE &&
          console.log(
            runIdLog +
              chalk.magentaBright("[CHUNKS]") +
              ": " +
              chalk.magentaBright(chunks.length + "CHUNKS")
          );

        // process.env.VERBOSE &&
        //   console.log(
        //     runIdLog +
        //       chalk.magentaBright("[TOKENS]") +
        //       ": " +
        //       chalk.white(
        //         `${newTokenCount} new TKNS from ${chunks.join("").length} CHARS`
        //       )
        //   );

        return { bank, newTokenCount, chunks, runId };
      })
    )
  );

  return await Promise.all(runs);
}

async function main() {
  const driver = neo4j.driver(
    process.env.NEOURI!,
    neo4j.auth.basic(process.env.NEOUSER!, process.env.NEOPASS!)
  );

  const sources: Source[] = [
    // { type: SourceType.wiki, identifier: "Operator_algebra" },
    // { type: SourceType.doc, identifier: "./package-lock.json" },
    { type: SourceType.doc, identifier: "./package.json" },
    // { type: SourceType.doc, identifier: "./tsconfig.json" },
  ];

  try {
    await processSources(driver, sources);
  } finally {
    await driver.close();
  }
}

main().catch(console.error);
