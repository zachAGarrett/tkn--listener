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
  verbose?: boolean;
  aggressivelyTrim?: boolean;
}
export const ingestWikipediaArticle = async ({
  title,
  maxCycles,
  knownTokens,
  verbose = false,
  aggressivelyTrim = false,
}: IngestWikipediaArticleProps) => {
  const timers = ["Retrieved article in", "Ingested article in"];

  verbose && console.time(timers[0]);
  const textContent = await getWikipediaArticle(title);
  verbose && console.timeEnd(timers[0]);

  let cycle = maxCycles;
  let tokenBank: TokenBank = knownTokens || {};
  let profile: ReturnType<typeof profileTokenBank> | undefined = undefined;

  while (cycle > 0) {
    verbose && console.time(timers[1]);
    const results = await ingestString(textContent, tokenBank);
    verbose && console.timeEnd(timers[1]);

    profile = profileTokenBank(results);

    verbose &&
      console.log(
        `Results after cycle ${maxCycles - cycle}:`,
        JSON.stringify(profile, undefined, 2)
      );

    tokenBank = aggressivelyTrim ? trimTokenBank(results) : results;
    cycle = cycle - 1;
  }

  verbose && console.log(`Elapsed cycles: ${maxCycles - cycle}`);

  return tokenBank;
};
