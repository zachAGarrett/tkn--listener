import { profileTokenBank } from "../../../lib/ingest/string/util.js";
import { ingestString, TokenBank } from "../../../lib/ingest/string/index.js";
import { getWikipediaArticle } from "./getArticle.js";

export interface IngestWikipediaArticleProps {
  title: string;
  knownTokens: TokenBank;
}
export const ingestWikipediaArticle = async ({
  title,
  knownTokens,
}: IngestWikipediaArticleProps) => {
  const timers = ["Retrieved article in", "Ingested article in"];

  process.env.VERBOSE && console.time(timers[0]);
  const textContent = await getWikipediaArticle(title);
  process.env.VERBOSE && console.timeEnd(timers[0]);

  let tokenBank: TokenBank = knownTokens || {};

  process.env.VERBOSE && console.time(timers[1]);
  const results = await ingestString(textContent, tokenBank);
  process.env.VERBOSE && console.timeEnd(timers[1]);

  process.env.VERBOSE &&
    console.log(
      "Bank:",
      JSON.stringify(profileTokenBank(results), undefined, 2)
    );

  return results;
};
