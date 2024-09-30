import { TokenBank } from "./lib/ingest/string/index.js";
import { ingestWikipediaArticle } from "./lib/sources/wikipedia/index.js";

const articles = ["API"];

let knownTokens: TokenBank = {};

for (const article of articles) {
  const results = await ingestWikipediaArticle({
    title: article,
    maxCycles: 40,
    growthRateCutoff: 20,
    knownTokens,
    verbose: true,
  });
  knownTokens = results;
}
