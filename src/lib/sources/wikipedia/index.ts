import {
  profileTokenBank,
  trimTokenBank,
} from "../../../lib/ingest/string/util.js";
import { ingestString, TokenBank } from "../../../lib/ingest/string/index.js";
import { getWikipediaArticle } from "./getArticle.js";

export interface IngestWikipediaArticleProps {
  title: string;
  maxCycles: number;
  knownTokens: TokenBank;
  aggressivelyTrim?: boolean;
}
export const ingestWikipediaArticle = async ({
  title,
  maxCycles,
  knownTokens,
  aggressivelyTrim = false,
}: IngestWikipediaArticleProps) => {
  const timers = ["Retrieved article in", "Ingested article in"];

  process.env.VERBOSE && console.time(timers[0]);
  const textContent = await getWikipediaArticle(title);
  process.env.VERBOSE && console.timeEnd(timers[0]);

  let cycle = maxCycles;
  let tokenBank: TokenBank = knownTokens || {};
  let profile: ReturnType<typeof profileTokenBank> | undefined = undefined;

  while (cycle > 0) {
    process.env.VERBOSE && console.time(timers[1]);
    const results = await ingestString(textContent, tokenBank);
    process.env.VERBOSE && console.timeEnd(timers[1]);

    profile = profileTokenBank(results);

    process.env.VERBOSE &&
      console.log(
        `Results after cycle ${maxCycles - cycle}:`,
        JSON.stringify(profile, undefined, 2)
      );

    tokenBank = aggressivelyTrim ? trimTokenBank(results) : results;
    cycle = cycle - 1;
  }

  process.env.VERBOSE && console.log(`Elapsed cycles: ${maxCycles - cycle}`);

  return tokenBank;
};
