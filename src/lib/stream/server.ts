import http, { IncomingMessage, ServerResponse } from "http";
import { encode, Token } from "../parse.js";

interface Message {
  data: string | number[];
}

// Function to handle incoming stream data
const handleStream = (req: IncomingMessage, res: ServerResponse): void => {
  const bank: Set<Token> = new Set();
  const parsed: Token[] = [];
  let w: number[] = [];
  let b_s: number = 0;

  if (req.method === "POST") {
    // Handle the streaming data in chunks
    req.on("data", (chunk: Buffer) => {
      // Check Content-Type to determine how to process each chunk
      if (req.headers["content-type"] === "application/json") {
        // It's JSON, so convert Buffer chunk to string and parse
        try {
          const { data }: Message = JSON.parse(chunk.toString("utf-8"));
          // Process the JSON data as needed here

          const isString = typeof data === "string";
          const l = data.length;

          for (let i = 0; i < l; i++) {
            const s = isString ? data.codePointAt(i) : data[i];
            if (s === undefined) continue;
            w.push(s);

            b_s = bank.size;
            bank.add(encode(w));
            if (bank.size > b_s) {
              // If the size of the bank increased after adding a token,
              // the token was unknown and we should process the current window
              if (w.length > 1) {
                parsed.push(encode(w.slice(0, -1))); // Add the previous token to the parsed array
              }
              w = [s]; // Reset window to current segment
            }
          }
        } catch (error) {
          console.error("Error parsing JSON chunk:", error);
          // Optionally, send error response for invalid chunks
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Invalid JSON data");
          return; // Early exit to prevent further processing
        }
      } else {
        // Unsupported content-type, respond with error
        res.writeHead(415, { "Content-Type": "text/plain" });
        res.end("Unsupported content-type");
        return; // Early exit
      }
    });

    // Handle the end of the stream
    req.on("end", () => {
      console.log("Stream ended");

      // Push any remaining window after the stream finishes
      if (w.length) {
        parsed.push(encode(w));
      }
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Stream received and processed\n");
    });

    // Handle any errors during the streaming process
    req.on("error", (err: Error) => {
      console.error("Error during stream:", err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Server error occurred");
    });
  } else {
    // Respond with 404 for non-POST requests
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Only POST requests are accepted");
  }
};

// Create an HTTP server and listen on port 3000
const server = http.createServer(handleStream);

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
