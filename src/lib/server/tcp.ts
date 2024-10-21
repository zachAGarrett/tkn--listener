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
  // Set up the variables for this socket conection
  const merged: { value: Tkn; idx: number }[] = [];
  const queue: Buffer[] = [];
  const sessionId: UUID = randomUUID();
  let bank: Set<Tkn> = new Set();
  let window: number[] = [];
  let dataLength: number = 0;
  let bankSize: number = 0;
  let tknCount: number = 0;
  let bankReady = false;
  let pushing = false;

  // function to refresh the bank
  async function refreshBank() {
    try {
      const topTkns = await getTopTkns(driver, 0.2);
      bank = new Set(topTkns);
      bankReady = true;
    } catch (err) {
      process.env.VERBOSE?.toLowerCase() === "true" &&
        console.error(
          chalk.yellowBright("[GETTING TOP TKNS]") +
            chalk.red("[FAIL]") +
            chalk.white((err as Neo4jError).code)
        );
      bankReady = true;
    }
  }

  // function to push the merged tokens to the remote
  async function pushMerged() {
    pushing = true;
    const session = driver.session(); // Create a new session
    // Create a transaction to push the tokens and their adjacency
    const tx = session.beginTransaction();
    try {
      while (merged.length) {
        // Check if we have at least two tokens to process
        if (merged.length < 2) {
          break; // Not enough tokens to push
        }
        const tkn1 = merged.shift()!;
        const tkn2 = merged[0]!;
        await tx.run(
          `
            MERGE (a:Tkn {value: $tkn1v})
            MERGE (b:Tkn {value: $tkn2v})
            CREATE (t1)-[:D1 {idx: $tkn1idx, sid: $sessionId}]->(t2)
          `,
          { sessionId, tkn1v: tkn1.value, tkn2v: tkn2.value, tkn1idx: tkn1.idx }
        );
      }
      await tx.commit();
    } catch (error) {
      console.error("Error pushing merged tokens:", error);
      await tx.rollback();
      throw error;
    } finally {
      await session.close(); // Ensure the session is closed
      pushing = false;
    }
  }

  console.log("New user connected from:", socket.remoteAddress);
  // Handle the connection
  refreshBank();

  socket.on("data", async (chunk: Buffer) => {
    queue.push(chunk);
    console.log(bankReady);

    if (!bankReady) {
      // Defer processing chunks until the bank is ready
      return;
    } else {
      // Process the enqueued chunks
      const data = parseBuffer(queue.shift()!); // There will always be a chunk in the queue

      dataLength = data.length;
      for (let i = 0; i < dataLength; i++) {
        const segment = data[i];
        if (segment === undefined) continue;
        window.push(segment);

        bankSize = bank.size;
        bank.add(encode(window));
        if (bank.size > bankSize) {
          // Adding the token increased the size of the set, so we know it was new
          if (window.length > 1) {
            merged.push({ value: encode(window.slice(0, -1)), idx: tknCount }); // Add the previous token
            tknCount += 1;
          }
          window = [segment]; // Reset window to current segment
        }
      }

      if (merged.length > 20 && pushing === false) {
        await pushMerged();
      }
    }
  });

  socket.on("end", async () => {
    // Push any remaining window after the connection ends
    if (window.length) {
      merged.push({ value: encode(window), idx: tknCount });
    }

    if (pushing === false) {
      await pushMerged();
    }

    console.log("Stream ended");
  });

  socket.on("error", (err: Error) => {
    console.error("Error during stream:", err);
  });
}
