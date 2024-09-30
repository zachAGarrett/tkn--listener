export interface TokenBank {
  [k: string]: number[];
}

export async function ingestString(input: string, persistentBank?: TokenBank) {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

  const graphemes = segmenter.segment(input);

  let window: string = "";
  let bank: TokenBank = { ...persistentBank } || {};

  for (const { segment, index } of graphemes) {
    const tkn = window + segment;
    if (bank.hasOwnProperty(tkn)) {
      bank[tkn] = [...bank[tkn], index];
      window = tkn;
    } else {
      bank[tkn] = [index];
      window = "";
    }
  }

  return bank;
}
