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
  EncodedToken,
  RunningStats,
} from "../../util/index.js";
import logs from "./logs.js";
import { pushTokens } from "./pushTokens.js";

export interface MergedToken {
  value: EncodedToken;
  idx: number;
}
export interface EnqueuedTask {
  chunk: Buffer;
  resolve: (value: void | PromiseLike<void>) => any;
}

// Function to handle incoming stream data over TCP
export async function handleStream(
  socket: net.Socket,
  driver: Driver
): Promise<void> {
  // Set up variables for this socket connection
  const merged: MergedToken[] = [];
  const queue: EnqueuedTask[] = [];
  const sessionId: UUID = randomUUID();
  const workers: Promise<void>[] = [];
  const throughputStats = new RunningStats();
  let pushOp: Promise<void> | undefined = undefined;
  let syncOp: Promise<void> | undefined = undefined;
  let bank: Set<EncodedToken> = new Set();
  let window: number[] = [];
  let taskCount = 0;
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

  // Worker function to process tasks from the queue
  async function worker() {
    const start = performance.now();
    const tasks = queue.splice(0)!;
    const data: number[] = [];
    const resolutions: ((value: void | PromiseLike<void>) => any)[] = [];
    let bytes: number = 0;
    let segment: number;
    let bankSize: number;
    let knownTkn: EncodedToken;
    let tokenIdx = 0;

    try {
      for (const { chunk, resolve } of tasks) {
        bytes += chunk.length;
        data.push(...parseChunk(chunk));
        resolutions.push(resolve);
      }

      taskCount = data.length;

      for (let i = 0; i < taskCount; i++) {
        segment = data[i];
        window.push(segment);
        bankSize = bank.size;
        bank.add(encode(window));

        if (bank.size > bankSize) {
          knownTkn = encode(window.slice(0, -1));
          merged.push({ value: knownTkn, idx: tokenIdx });
          window = [segment]; // Reset window to only the current segment
          tokenIdx += 1;
        }
      }

      await Promise.all(resolutions); // Resolve all tasks
      return { bytes, start, end: performance.now() };
    } finally {
      working = false; // Release the worker slot
    }
  }

  // Queue a new task and ensure the worker is running
  function enqueueTask(chunk: Buffer) {
    return new Promise<void>((resolve) => {
      queue.push({ chunk, resolve });
      if (!working) {
        workers.push(
          worker()
            .then(({ bytes, start, end }) => {
              const duration = end - start;
              const throughput = bpiToMbps(bytes, duration);
              throughputStats.add(throughput, duration);
              logs.taskThroughputStats(sessionId, throughput);
            })
            .then(() => {
              if (
                merged.length > Number(process.env.PUSHAT || 20) &&
                pushOp === undefined
              ) {
                pushOp = pushTokens(sessionId, merged, driver)
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
            })
        );
      }
    });
  }

  // Event: New user connected

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
        await pushTokens(sessionId, merged, driver);
      }
    }
    logs.sessionComplete(sessionId, throughputStats);
  });

  socket.on("error", (err: Error) => {
    log(sessionId, undefined, `Error during stream: ${err.message}`, "error");
  });
}
