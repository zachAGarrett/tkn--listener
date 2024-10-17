import chalk from "chalk";
import { TokenBank } from "../../util/tokenBank.js";

export function read(
  corpus: string,
  bank: TokenBank = new Map(),
  runId: string
) {
  const parseCompletionLog =
    chalk.blueBright(`[${runId}]`) + chalk.magentaBright("[PARSED]");
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const graphemes = segmenter.segment(corpus);
  const parsed: string[] = [];
  let w: string = "";
  let w_i: number = 0;

  process.env.VERBOSE && console.time(parseCompletionLog);
  for (const { segment: s, index: s_i } of graphemes) {
    const tkn = w + s;
    if (bank.get(tkn) === undefined) {
      // Reset the window on unknown tokens
      bank.set(tkn, "");
      if (w !== "") {
        bank.set(w, (bank.get(w) || "") + "|" + w_i);
        parsed.push(w);
      }
      w = s;
      w_i = s_i;
    } else {
      // Grow the window if the token is recognized
      w = tkn;
    }
  }
  process.env.VERBOSE && console.timeEnd(parseCompletionLog);

  return { parsed, runId };
}
