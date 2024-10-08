import { TokenBank } from "./lib/ingest/string/index.js";
import { profileTokenBank, trimTokenBank } from "./lib/ingest/string/util.js";
import { ingestWikipediaArticle } from "./lib/sources/wikipedia/index.js";
import env from "dotenv";
env.config();

const articles = ["Operator_algebra", "API"];

let memory: TokenBank = new Map();

for (const article of articles) {
  const results = await ingestWikipediaArticle({
    title: article,
    maxCycles: 10,
    knownTokens: memory,
    aggressivelyTrim: true,
  });

  const trimmedMemory = trimTokenBank(results);
  process.env.VERBOSE && console.log("Bank:", profileTokenBank(trimmedMemory));

  memory = trimmedMemory;
}
