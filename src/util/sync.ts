import { Driver } from "neo4j-driver";
import { AdjacencyList } from "./buildAdjacencyList.js";
import chalk from "chalk";

export async function sync(
  adjacencyList: AdjacencyList,
  driver: Driver,
  runId: string,
  batchSize: number = 200
) {
  const logBase =
    chalk.yellowBright("[SYNCING]") + chalk.blueBright(`[${runId}]`);
  const session = driver.session();
  let tx = session.beginTransaction();
  process.env.VERBOSE &&
    console.log(
      logBase +
        chalk.magentaBright("[PUSHING]") +
        chalk.white(adjacencyList.size + "tkns")
    );

  let opsCt = 0;

  try {
    for (const [tkn, precedingTkns] of adjacencyList.entries()) {
      // Use UNWIND to pass all preceding tokens in a single query
      await tx.run(
        `
        UNWIND $precedingTkns AS preceding
        MERGE (p:Tkn { value: preceding.tkn })
        MERGE (t:Tkn { value: $currentTkn })
        CREATE (p)-[r:PRECEDES { idx: preceding.idx, runId: preceding.rId }]->(t)
        `,
        {
          precedingTkns: precedingTkns.map((t) => ({
            tkn: t.tkn,
            idx: t.idx,
            rId: t.rId,
          })),
          currentTkn: tkn,
        }
      );

      opsCt++;

      // Commit after every `batchSize` operations
      if (opsCt % batchSize === 0) {
        await tx.commit();
        process.env.VERBOSE &&
          console.log(
            logBase +
              chalk.magentaBright("[COMMITTED]") +
              chalk.white(opsCt + "tkns")
          );
        // Start a new transaction after commit
        tx = session.beginTransaction();
      }
    }

    // Commit any remaining operations
    await tx.commit();
    process.env.VERBOSE &&
      console.log(
        logBase +
          chalk.magentaBright("[COMMITTED]") +
          chalk.white((opsCt % batchSize) + "tkns")
      );
  } catch (error) {
    process.env.VERBOSE &&
      console.error(
        logBase + "Transaction failed and will be rolled back:",
        error
      );
    await tx.rollback();
    throw error;
  } finally {
    await session.close();
  }
}
