export type TokenBank = Map<string, number[]>;

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
    if (bank.has(tkn)) {
      bank.get(tkn)!.push(index);
      window = tkn;
    } else {
      bank.set(tkn, [index]);
      window = "";
    }
  }

  return bank;
}
