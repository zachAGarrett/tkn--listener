import { ingestString, TokenBank } from "./lib/ingest/string/index.js";
import { getWikipediaArticle } from "./lib/sources/wikipedia/index.js";

const timers = ["Retrieved article in", "Ingested article in"];

console.time(timers[0]);
const textContent = await getWikipediaArticle("Operator_algebra");
console.timeEnd(timers[0]);

const totalCycles = 100;
const growthCutoff = 2;
let cycle = totalCycles;
let persistentBank: TokenBank = {};
let growthOverCycle: number = Infinity;

while (cycle > 0 && growthOverCycle > growthCutoff) {
  console.time(timers[1]);
  const results = await ingestString(textContent, persistentBank);
  console.timeEnd(timers[1]);

  const sortedBank = Object.entries(results)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([value, instances]) => [value, instances.length + " instances"]);

  const previouslyKnownTokenSetSize = Object.keys(persistentBank).length;
  const resultingTokenSetSize = sortedBank.length;
  growthOverCycle =
    ((resultingTokenSetSize - previouslyKnownTokenSetSize) /
      previouslyKnownTokenSetSize) *
    100;

  console.log(
    `Results after cycle ${totalCycles - cycle}:`,
    `Tokens in bank: ${resultingTokenSetSize}`,
    `Growth over cycle: ${Math.round(growthOverCycle)}%`
  );

  persistentBank = results;
  cycle = cycle - 1;
}

console.log(`Elapsed cycles: ${totalCycles - cycle}`);
