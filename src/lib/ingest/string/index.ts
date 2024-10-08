export type TokenBank = Map<string, string>;

export async function ingestString(
  input: string,
  knownTokens?: TokenBank
): Promise<TokenBank> {
  const timers = ["Parsed graphemes", "Parsed tokens from graphemes"];
  process.env.VERBOSE && console.time(timers[0]);
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const graphemes = segmenter.segment(input);
  process.env.VERBOSE && console.timeEnd(timers[0]);

  let window: string = "";
  let bank: TokenBank = new Map(knownTokens);
  let currentIndex: number = 0;
  let newTokenCount: number = 0;

  process.env.VERBOSE && console.time(timers[1]);
  for (const { segment, index } of graphemes) {
    const tkn = window + segment;
    const existingIndices = bank.get(tkn);
    if (existingIndices) {
      window = tkn;
    } else {
      bank.set(tkn, String(index));
      bank.set(window, existingIndices + "|" + String(index));
      window = "";
      newTokenCount += 1;
    }
    currentIndex += 1;
  }
  process.env.VERBOSE && console.timeEnd(timers[1]);

  process.env.VERBOSE &&
    console.log(
      "New tokens: " +
        newTokenCount +
        " | " +
        "Graphemes Parsed: " +
        currentIndex
    );
  return bank;
}
