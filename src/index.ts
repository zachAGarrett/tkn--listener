import { TokenBank } from "./lib/ingest/string/index.js";
import { profileTokenBank, trimTokenBank } from "./lib/ingest/string/util.js";
import { ingestWikipediaArticle } from "./lib/sources/wikipedia/index.js";

const articles = ["Operator_algebra", "API"];

let memory: TokenBank = new Map();

for (const article of articles) {
  const results = await ingestWikipediaArticle({
    title: article,
    maxCycles: 10,
    knownTokens: memory,
    verbose: true,
    aggressivelyTrim: true,
  });

  const trimmedMemory = trimTokenBank(results);
  console.log(profileTokenBank(trimmedMemory));

  memory = trimmedMemory;
}
