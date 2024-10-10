import { TokenBank } from "./lib/ingest/string/index.js";
import { trimTokenBank } from "./lib/ingest/string/util.js";
import { ingestWikipediaArticle } from "./lib/sources/wikipedia/index.js";
import env from "dotenv";
env.config();

const articles = ["Operator_algebra", "API"];

let memory: TokenBank = new Map();

for (const article of articles) {
  const results = await ingestWikipediaArticle({
    title: article,
    knownTokens: memory,
  });

  const trimmedResults = trimTokenBank({
    tokenBank: results,
  });

  // Send the relationship results to a persistent store like neo4j
  /**
   * add implementation details
   */

  // Add the tokens to the rolling memory but remove the indices
  trimmedResults.forEach((_, token) => memory.set(token, ""));
}
