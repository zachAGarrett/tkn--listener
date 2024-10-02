export type TokenBank = Map<string, string>;

export async function ingestString(
  input: string,
  knownTokens?: TokenBank
): Promise<TokenBank> {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const graphemes = segmenter.segment(input);

  let window: string = "";
  let bank: TokenBank = new Map(knownTokens);

  for (const { segment, index } of graphemes) {
    const tkn = window + segment;
    const existingIndices = bank.get(tkn);
    if (existingIndices) {
      window = tkn;
    } else {
      bank.set(tkn, String(index));
      bank.set(window, existingIndices + "|" + String(index));
      window = "";
    }
  }

  return bank;
}
