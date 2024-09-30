import { ingestString, TokenBank } from "../../../lib/ingest/string/index.js";
import { getWikipediaArticle } from "./getArticle.js";
import { calculateCycleGrowth, profileTokenBank } from "../../../util/math.js";

export interface IngestWikipediaArticleProps {
  title: string;
  maxCycles: number;
  growthRateCutoff: number;
  knownTokens: TokenBank;
  verbose?: boolean;
}
export const ingestWikipediaArticle = async ({
  title,
  maxCycles,
  growthRateCutoff,
  knownTokens,
  verbose = false,
}: IngestWikipediaArticleProps) => {
  const timers = ["Retrieved article in", "Ingested article in"];

  verbose && console.time(timers[0]);
  const textContent = await getWikipediaArticle(title);
  verbose && console.timeEnd(timers[0]);

  let cycle = maxCycles;
  let tokenBank: TokenBank = { ...knownTokens } || {};
  let growthOverCycle: number = Infinity;
  let profile: ReturnType<typeof profileTokenBank> | undefined = undefined;

  while (cycle > 0 && growthOverCycle > growthRateCutoff) {
    verbose && console.time(timers[1]);
    const results = await ingestString(textContent, tokenBank);
    verbose && console.timeEnd(timers[1]);

    profile = profileTokenBank(results);
    growthOverCycle = calculateCycleGrowth(tokenBank, results);

    verbose &&
      console.log(
        `Results after cycle ${maxCycles - cycle}:`,
        `Growth over cycle: ${Math.round(growthOverCycle)}%`,
        JSON.stringify(profile, undefined, 2)
      );

    tokenBank = results;
    cycle = cycle - 1;
  }

  verbose && console.log(`Elapsed cycles: ${maxCycles - cycle}`);

  return tokenBank;
};
