import net from "net";
import { getTopTkns } from "../neo4j/gds/getTopTokens.js";
import { Driver, Neo4jError } from "neo4j-driver";
import { randomUUID, UUID } from "crypto";
import { encode, log, parseChunk, Tkn } from "../../util/index.js";

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
  let bank: Set<Tkn> = new Set();
  let window: number[] = [];
  let dataLength = 0;
  let tokenIdx = 0;
  let bankReady = true;
  let pushing = false;
  let working = false;

  // Function to refresh the token bank
  async function refreshBank() {
    bankReady = false;
    const opId = randomUUID();
    log(`[${opId}]: Refreshing bank...`, "info");
    try {
      bank = new Set(await getTopTkns(driver, 0.2));
      log(`[${opId}]: Bank refreshed.`, "success");
      bankReady = true;
    } catch (err) {
      log(
        `[${opId}]: Failed to refresh bank. Code: ${(err as Neo4jError).code}`,
        "error"
      );
      bankReady = true;
    }
  }

  // Function to push merged tokens to Neo4j
  async function pushMergedTokens() {
    const opId = randomUUID();
    log(`[${opId}]: Pushing ${merged.length} tokens...`, "info");
    pushing = true;
    const session = driver.session();
    const tx = session.beginTransaction();

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
      }
      await tx.commit();
      log(`[${opId}]: Tokens pushed successfully.`, "success");
    } catch (error) {
      log(
        `[${opId}]: Error pushing tokens: ${(error as any).message}`,
        "error"
      );
      await tx.rollback();
    } finally {
      await session.close();
      pushing = false;
    }
  }

  // Worker function to process tasks from the queue
  async function worker() {
    if (working) return; // Early exit if another worker is already processing
    working = true; // Claim the worker slot

    try {
      while (queue.length) {
        const tasks = queue.splice(0)!;
        const data: number[] = [];
        const resolutions: ((value: void | PromiseLike<void>) => any)[] = [];

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

        if (merged.length > Number(process.env.PUSHAT || 20) && !pushing) {
          await pushMergedTokens().then(refreshBank).catch(console.error);
        }

        await Promise.all(resolutions); // Resolve all tasks
      }
    } finally {
      working = false; // Release the worker slot
    }
  }

  // Queue a new task and ensure the worker is running
  function enqueueTask(chunk: Buffer) {
    return new Promise<void>((resolve) => {
      queue.push({ chunk, resolve });
      if (!working && bankReady) {
        workers.push(worker());
      }
    });
  }

  // Event: New user connected
  console.log(`New user connected from: ${socket.remoteAddress}`);
  refreshBank();

  socket.on("data", (chunk: Buffer) => enqueueTask(chunk));

  socket.on("end", async () => {
    socket.write(sessionId);
    if (window.length)
      merged.push({ value: encode(window), idx: merged.length });

    await Promise.all(workers);
    await new Promise<void>(async (resolve) => {
      if (!working && queue.length === 0) {
        await pushMergedTokens();
        resolve();
      }
    });

    log("Stream ended. All tokens pushed.", "success");
  });

  socket.on("error", (err: Error) => {
    log(`Error during stream: ${err.message}`, "error");
  });
}
