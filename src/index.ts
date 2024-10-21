import net from "net";
import neo4j from "neo4j-driver";
import { handleStream } from "./lib/server/tcp.js";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const driver = neo4j.driver(
    process.env.NEOURI!,
    neo4j.auth.basic(process.env.NEOUSER!, process.env.NEOPASS!)
  );

  const server = net.createServer((socket) => handleStream(socket, driver));

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`TCP server listening on port ${PORT}`);
  });
}

main().catch(console.error);
