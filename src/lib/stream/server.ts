import net from "net";
import { encode, Token } from "../parse.js";

// Function to parse numerical data from a buffer (assuming 32-bit integers)
const parseBuffer = (chunk: Buffer): number[] => {
  const numbers: number[] = [];
  for (let i = 0; i < chunk.length; i += 4) {
    const num = chunk.readInt32LE(i); // Read as 32-bit little-endian integer
    numbers.push(num);
  }
  return numbers;
};

// Function to handle incoming stream data over TCP
const handleStream = (socket: net.Socket): void => {
  console.log("New user connected from:", socket.remoteAddress);

  const bank: Set<Token> = new Set();
  const parsed: Token[] = [];
  let dataLength: number = 0;
  let window: number[] = [];
  let bankSize: number = 0;

  socket.on("data", (chunk: Buffer) => {
    const data = parseBuffer(chunk);
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
          parsed.push(encode(window.slice(0, -1))); // Add the previous token
        }
        window = [segment]; // Reset window to current segment
      }
    }
  });

  socket.on("end", () => {
    // Push any remaining window after the loop finishes
    if (window.length) {
      parsed.push(encode(window));
    }

    console.log("Stream ended");
  });

  socket.on("error", (err: Error) => {
    console.error("Error during stream:", err);
  });
};

// Create a TCP server and listen on port 3000
const server = net.createServer(handleStream);

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`TCP server listening on port ${PORT}`);
});
