import { Driver } from "neo4j-driver";
import * as fs from "fs";

// Function to reconstruct a file from tokens in Neo4j based on a session ID
export async function reconstructFileFromSession(
  driver: Driver,
  sessionId: string,
  outputFilePath: string
): Promise<void> {
  const session = driver.session();

  try {
    // Run the Cypher query to get an ordered list of tokens for the session
    const result = await session.run(
      `
      MATCH (tkn1:Tkn)-[r:D1 {sid: $sessionId}]->(tkn2:Tkn)
      WITH tkn1, r.idx AS index, tkn2
      ORDER BY r.idx
      RETURN tkn1.value as tkn, index as idx
      `,
      { sessionId }
    );

    // Check if any tokens were returned
    if (result.records.length === 0) {
      console.log("No tokens found for the given session ID.");
      return;
    }

    // Get the ordered tokens from the query result
    const tokens: string[] = result.records[0].get("tokens");

    // Create a writable stream to the output file
    const outputStream = fs.createWriteStream(outputFilePath);

    // Reconstruct the content from the ordered tokens
    for (const token of tokens) {
      // Write tokens to the file, adjusting the format as necessary
      outputStream.write(`${token}`); // Append tokens without delimiters
    }

    // Close the output stream
    outputStream.end();

    console.log(`File successfully reconstructed at: ${outputFilePath}`);
  } catch (error) {
    console.error("Error reconstructing file:", error);
  } finally {
    await session.close();
  }
}

// Example usage:
// const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
// await reconstructFileFromSession(driver, "your-session-id", path.join(__dirname, "output.txt"));
