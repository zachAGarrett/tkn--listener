import net from "net";
import { getTopTkns } from "../neo4j/gds/getTopTokens.js";
import { Driver, Neo4jError } from "neo4j-driver";
import chalk from "chalk";
import { randomUUID, UUID } from "crypto";
import { encode, parseBuffer, Tkn } from "../../util/index.js";

// Function to handle incoming stream data over TCP
export async function handleStream(
  socket: net.Socket,
  driver: Driver
): Promise<void> {
  // Set up the variables for this socket connection
  const merged: { value: Tkn; idx: number }[] = [];
  const queue: { chunk: Buffer; resolve: Function }[] = []; // Queue to store incoming data chunks
  const sessionId: UUID = randomUUID();
  let bank: Set<Tkn> = new Set();
  let window: number[] = [];
  let dataLength: number = 0;
  let bankSize: number = 0;
  let tknCount: number = 0;
  let bankReady = false;
  let pushing = false;
  let working = false; // Flag to track if the worker is processing

  // function to refresh the bank
  async function refreshBank() {
    const opId = randomUUID();
    process.env.VERBOSE?.toLowerCase() === "true" &&
      console.log(
        `[${chalk.blueBright(opId)}]: ${chalk.magentaBright("Refreshing bank")}`
      );
    try {
      const topTkns = await getTopTkns(driver, 0.2);
      bank = new Set(topTkns);
      bankReady = true;
      process.env.VERBOSE?.toLowerCase() === "true" &&
        console.log(
          `[${chalk.blueBright(opId)}]: ${chalk.greenBright("Bank refreshed")}`
        );
    } catch (err) {
      process.env.VERBOSE?.toLowerCase() === "true" &&
        console.error(
          chalk.yellowBright("[GETTING TOP TKNS]") +
            chalk.red("[FAIL]") +
            chalk.white((err as Neo4jError).code)
        );
      bankReady = true;
      process.env.VERBOSE?.toLowerCase() === "true" &&
        console.log(
          `[${chalk.blueBright(opId)}]: ${chalk.redBright(
            "Failed to refresh bank"
          )}`
        );
    }
  }

  async function pushMergedTokens() {
    const opId = randomUUID();
    process.env.VERBOSE?.toLowerCase() === "true" &&
      console.log(
        `[${chalk.blueBright(opId)}]: ${chalk.magentaBright(
          `Pushing ${chalk.yellowBright(merged.length)} tokens`
        )}`
      );
    pushing = true;
    const session = driver.session(); // Create a new session
    // Create a transaction to push the tokens and their adjacency
    const tx = session.beginTransaction();
    try {
      while (merged.length) {
        if (merged.length < 2) {
          break;
        }
        const tkn1 = merged.shift()!;
        const tkn2 = merged[0]!;
        await tx.run(
          `
            MERGE (tkn1:Tkn {value: $tkn1v})
            MERGE (tkn2:Tkn {value: $tkn2v})
            MERGE (tkn1)-[:D1 {idx: $tkn1idx, sid: $sessionId}]->(tkn2)
          `,
          {
            sessionId,
            tkn1v: tkn1.value,
            tkn2v: tkn2.value,
            tkn1idx: tkn1.idx,
          }
        );
      }
      await tx.commit();
    } catch (error) {
      process.env.VERBOSE?.toLowerCase() === "true" &&
        console.log(
          `[${chalk.blueBright(opId)}]: ${chalk.redBright(
            "Error pushing merged tokens:",
            error
          )}`
        );
      console.error("Error pushing merged tokens:", error);
      await tx.rollback();
      throw error;
    } finally {
      await session.close(); // Ensure the session is closed
      pushing = false;
      process.env.VERBOSE?.toLowerCase() === "true" &&
        console.log(
          `[${chalk.blueBright(opId)}]: ${chalk.greenBright(
            `Finished pushing tokens`
          )}`
        );
    }
  }

  // Worker function to process tasks from the queue
  async function worker() {
    while (queue.length) {
      const { chunk, resolve } = queue.shift()!; // Get the next task
      const data = parseBuffer(chunk);

      dataLength = data.length;

      for (let i = 0; i < dataLength; i++) {
        const segment = data[i];
        if (segment === undefined) continue;
        window.push(segment);

        bankSize = bank.size;
        bank.add(encode(window));
        if (bank.size > bankSize) {
          if (window.length > 1) {
            const knownTkn = encode(window.slice(0, -1));
            process.env.VERBOSE?.toLowerCase() === "true" &&
              console.log(chalk.yellowBright(knownTkn));
            merged.push({ value: knownTkn, idx: tknCount }); // Add the previous token
            tknCount += 1;
          }
          window = [segment]; // Reset window to current segment
        }
      }

      if (
        merged.length > Number(process.env.PUSHAT || 20) &&
        pushing === false
      ) {
        await pushMergedTokens()
          .then(async () => refreshBank())
          .catch((error) => console.error(error));
      }

      resolve(); // Mark this task as done
    }
    working = false; // Mark worker as idle
  }

  // Queue a new task and ensure the worker is running
  function enqueueTask(chunk: Buffer) {
    return new Promise<void>((resolve) => {
      queue.push({ chunk, resolve });
      if (!working) {
        working = true;
        worker(); // Start the worker if it's not already running
      }
    });
  }

  console.log("New user connected from:", socket.remoteAddress);
  // Handle the connection
  refreshBank();

  socket.on("data", async (chunk: Buffer) => {
    // Queue the data processing task
    await enqueueTask(chunk);
  });

  socket.on("end", async () => {
    // Push any remaining window after the connection ends
    if (window.length) {
      merged.push({ value: encode(window), idx: tknCount });
    }

    // Wait for all queued tasks to finish
    await new Promise<void>((resolve) => {
      const interval = setInterval(async () => {
        if (!working && queue.length === 0) {
          clearInterval(interval);
          await pushMergedTokens(); // Ensure any remaining tokens are pushed
          resolve();
        }
      }, 100); // Check every 100ms if the worker has finished
    });

    console.log(chalk.greenBright("Stream ended and all tokens pushed."));
  });

  socket.on("error", (err: Error) => {
    console.error("Error during stream:", err);
  });
}
