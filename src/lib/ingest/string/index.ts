import chalk from "chalk";

export interface ReadResponse {
  parsed: string[] | undefined;
  runId: string;
}
export function read(
  corpus: string,
  bank: Set<string> = new Set(),
  runId: string
): ReadResponse {
  const parseCompletionLog =
    chalk.yellowBright("[PARSING]") +
    chalk.blueBright(`[${runId}]`) +
    chalk.magentaBright("[PARSED]");
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const graphemes = segmenter.segment(corpus);
  const parsed: string[] = [];
  let w: string = "";

  process.env.VERBOSE && console.time(parseCompletionLog);
  for (const { segment: s } of graphemes) {
    const tkn = w + s;
    if (bank.has(tkn)) {
      // Grow the window if the token is recognized
      w = tkn;
    } else {
      // Reset the window on unknown tokens
      bank.add(tkn);
      if (w !== "") {
        bank.add(w);
        parsed.push(w);
      }
      w = s;
    }
  }
  process.env.VERBOSE && console.timeEnd(parseCompletionLog);

  return { parsed, runId };
}
