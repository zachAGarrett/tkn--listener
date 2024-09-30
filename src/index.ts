import { ingestString, TokenBank } from "./lib/ingest/string/index.js";
import { getWikipediaArticle } from "./lib/sources/wikipedia/index.js";

const timers = ["Retrieved article", "Ingested article"];

console.time(timers[0]);
const textContent = await getWikipediaArticle("Operator_algebra");
console.timeEnd(timers[0]);

const totalCycles = 20;
let cycle = totalCycles;
let persistentBank: TokenBank = {};

while (cycle > 0) {
  console.time(timers[1]);
  const results = await ingestString(textContent, persistentBank);
  console.timeEnd(timers[1]);

  const sortedBank = Object.entries(results)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([value, instances]) => [value, instances.length + " instances"]);

  const previouslyKnownTokenSetSize = Object.keys(persistentBank).length;
  const resultingTokenSetSize = sortedBank.length;

  console.log(
    `Results after cycle ${totalCycles - cycle}:`,
    sortedBank.slice(0, 10),
    `Tokens in bank: ${resultingTokenSetSize}`,
    `Growth over cycle: ${Math.round(
      ((resultingTokenSetSize - previouslyKnownTokenSetSize) /
        previouslyKnownTokenSetSize) *
        100
    )}%`
  );

  persistentBank = results;
  cycle = cycle - 1;
}
