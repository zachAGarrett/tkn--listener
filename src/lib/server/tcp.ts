import net from "net";
import { getTopTkns } from "../neo4j/gds/getTopTokens.js";
import { Driver, Neo4jError } from "neo4j-driver";
import { randomUUID, UUID } from "crypto";
import { performance } from "perf_hooks"; // Node.js built-in module
import {
  bpiToMbps,
  encode,
  log,
  parseChunk,
  Tkn,
  RunningStats,
} from "../../util/index.js";
import chalk from "chalk";

// Function to handle incoming stream data over TCP
export async function handleStream(
  socket: net.Socket,
  driver: Driver
): Promise<void> {
  // Set up variables for this socket connection
  const merged: { value: Tkn; idx: number }[] = [];
  const queue: {
    chunk: Buffer;
    resolve: (value: void | PromiseLike<void>) => any;
  }[] = [];
  const sessionId: UUID = randomUUID();
  const workers: Promise<void>[] = [];
  const throughputStats = new RunningStats();
  let pushOp: Promise<void> | undefined = undefined;
  let syncOp: Promise<void> | undefined = undefined;
  let bank: Set<Tkn> = new Set();
  let window: number[] = [];
  let dataLength = 0;
  let tokenIdx = 0;
  let working = false;

  // Function to refresh the token bank
  async function syncBank() {
    const opId = randomUUID();
    log(sessionId, opId, `Refreshing bank...`, "info");
    try {
      bank = new Set(await getTopTkns(driver, 0.7));
      log(sessionId, opId, `Bank refreshed.`, "success");
    } catch (err) {
      log(
        sessionId,
        opId,
        `Failed to refresh bank. Code: ${(err as Neo4jError).code}`,
        "error"
      );
    }
  }

  // Function to push merged tokens to Neo4j
  async function pushTokens() {
    const opId = randomUUID();
    const session = driver.session();
    const tx = session.beginTransaction();
    let txCounter = 0;

    try {
      while (merged.length >= 2) {
        const tkn1 = merged.shift()!;
        const tkn2 = merged[0]!;
        await tx.run(
          `
            MERGE (tkn1:Tkn {value: $tkn1v})
            MERGE (tkn2:Tkn {value: $tkn2v})
            MERGE (tkn1)-[:D1 {idx: $tkn1idx, sid: $sessionId}]->(tkn2)
          `,
          { sessionId, tkn1v: tkn1.value, tkn2v: tkn2.value, tkn1idx: tkn1.idx }
        );
        txCounter += 1;
      }
      await tx.commit();
      log(sessionId, opId, `${txCounter} successful transactions.`, "success");
    } catch (error) {
      log(
        sessionId,
        opId,
        `Error pushing tokens: ${(error as any).message}`,
        "error"
      );
      await tx.rollback();
    } finally {
      await session.close();
    }
  }

  // Worker function to process tasks from the queue
  async function worker() {
    const start = performance.now();
    const tasks = queue.splice(0)!;
    const data: number[] = [];
    const resolutions: ((value: void | PromiseLike<void>) => any)[] = [];
    let duration: number;
    let bytes: number;

    try {
      for (const { chunk, resolve } of tasks) {
        data.push(...parseChunk(chunk));
        resolutions.push(resolve);
      }

      dataLength = data.length;

      for (let i = 0; i < dataLength; i++) {
        const segment = data[i];
        window.push(segment);

        const bankSize = bank.size;
        bank.add(encode(window));

        if (bank.size > bankSize) {
          const knownTkn = encode(window.slice(0, -1));
          merged.push({ value: knownTkn, idx: tokenIdx });
          window = [segment]; // Reset window to only the current segment
          tokenIdx += 1;
        }
      }

      if (
        merged.length > Number(process.env.PUSHAT || 20) &&
        pushOp === undefined
      ) {
        pushOp = pushTokens()
          .then(
            () =>
              (syncOp =
                syncOp === undefined
                  ? syncBank().finally(() => (syncOp = undefined))
                  : undefined)
          )
          .catch(console.error)
          .finally(() => (pushOp = undefined));
      }

      await Promise.all(resolutions); // Resolve all tasks
      duration = performance.now() - start;
      bytes = tasks.reduce((sum, { chunk }) => sum + chunk.length, 0);
      const throughput = bpiToMbps(bytes, duration);
      throughputStats.add(throughput, duration);
      log(
        sessionId,
        undefined,
        `${throughput.toFixed(2)} ${chalk.gray("MB/s")}`,
        "info"
      );
    } finally {
      working = false; // Release the worker slot
    }
  }

  // Queue a new task and ensure the worker is running
  function enqueueTask(chunk: Buffer) {
    return new Promise<void>((resolve) => {
      queue.push({ chunk, resolve });
      if (!working) {
        workers.push(worker());
      }
    });
  }

  // Event: New user connected
  console.log(`New user connected from: ${socket.remoteAddress}`);

  socket.write(sessionId);

  syncOp = syncBank();

  socket.on("data", (chunk: Buffer) => enqueueTask(chunk));

  socket.on("end", async () => {
    if (window.length)
      merged.push({ value: encode(window), idx: merged.length });

    await Promise.all(workers);
    if (merged.length) {
      if (pushOp) {
        await pushOp;
      } else {
        await pushTokens();
      }
    }
    log(sessionId, undefined, "Stream ended. All tokens pushed.", "success");
    log(
      sessionId,
      undefined,
      `${[
        `${throughputStats.getMin()?.toFixed(2)} ${chalk.gray("min")}`,
        `${throughputStats.getStandardDeviation()!.toFixed(2)} ${chalk.gray(
          "std"
        )}`,
        `${throughputStats.getMax()?.toFixed(2)} ${chalk.gray("max")}`,
        `${throughputStats.getWeightedAverage()?.toFixed(2)} ${chalk.gray(
          "mean"
        )}`,
      ].join(chalk.redBright(" | "))} ${chalk.gray("MB/s")}`,
      "info"
    );
  });

  socket.on("error", (err: Error) => {
    log(sessionId, undefined, `Error during stream: ${err.message}`, "error");
  });
}
