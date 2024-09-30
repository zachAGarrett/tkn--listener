import { ingestString, TokenBank } from "./lib/ingest/string/index.js";
import { getWikipediaArticle } from "./lib/sources/wikipedia/index.js";
import { calculateCycleGrowth, mean, profileTokenBank } from "./util/math.js";

const timers = ["Retrieved article in", "Ingested article in"];

console.time(timers[0]);
const textContent = await getWikipediaArticle("Operator_algebra");
console.timeEnd(timers[0]);

const totalCycles = 100;
const growthCutoff = 4;
let cycle = totalCycles;
let persistentBank: TokenBank = {};
let growthOverCycle: number = Infinity;
let profile: ReturnType<typeof profileTokenBank> | undefined = undefined;

while (cycle > 0 && growthOverCycle > growthCutoff) {
  console.time(timers[1]);
  const results = await ingestString(textContent, persistentBank);
  console.timeEnd(timers[1]);

  profile = profileTokenBank(results);
  growthOverCycle = calculateCycleGrowth(persistentBank, results);

  console.log(
    `Results after cycle ${totalCycles - cycle}:`,
    `Growth over cycle: ${Math.round(growthOverCycle)}%`,
    JSON.stringify(profile, undefined, 2)
  );

  persistentBank = results;
  cycle = cycle - 1;
}

console.log(`Elapsed cycles: ${totalCycles - cycle}`);

// const sortedBank = Object.entries(persistentBank)
//   .sort((a, b) => b[1].length - a[1].length)
//   .map(([value, instances]) => [value, instances.length + " instances"]);

// console.log(
//   sortedBank.slice(0, 1000),
//   `Token Bank Profile: ${JSON.stringify(profile, undefined, 2)}`
// );
