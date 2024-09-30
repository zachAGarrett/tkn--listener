import { TokenBank } from "./lib/ingest/string/index.js";
import { ingestWikipediaArticle } from "./lib/sources/wikipedia/index.js";
import { profileTokenBank, trimTokenBank } from "./util/math.js";

const articles = ["Operator_algebra", "API"];

let memory: TokenBank = {};

for (const article of articles) {
  const results = await ingestWikipediaArticle({
    title: article,
    maxCycles: 40,
    growthRateCutoff: 20,
    knownTokens: memory,
    verbose: true,
  });

  const trimmedMemory = trimTokenBank(results);
  console.log(profileTokenBank(trimmedMemory));

  memory = trimmedMemory;
}
