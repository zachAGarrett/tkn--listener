
export type Token = string;
export interface ParseResponse {
  parsed: string[] | undefined;
  runId: string;
  opct: number;
}
export function parse(
  corpus: string | number[],
  bank: Set<Token> = new Set(),
  runId: string
): ParseResponse {
  const isString = typeof corpus === "string";
  const l = corpus.length;
  const parsed: Token[] = [];
  let w: number[] = [];
  let bs_l: number = 0;

  for (let i = 0; i < l; i++) {
    const s = isString ? corpus.codePointAt(i) : corpus[i];
    if (s === undefined) continue;
    w.push(s);

    bs_l = bank.size;
    bank.add(encode(w));
    if (bank.size > bs_l) {
      // Token was unknown, process the current window
      if (w.length > 1) {
        parsed.push(encode(w.slice(0, -1))); // Add the previous token
      }
      w = [s]; // Reset window to current segment
    }
  }

  // Push any remaining window after the loop finishes
  if (w.length) {
    parsed.push(encode(w));
  }

  return { parsed, runId, opct: l };
}

export function encode(arr: number[]): Token {
  const buffer = Buffer.alloc(arr.length * 4); // 4 bytes for each integer
  for (let i = 0; i < arr.length; i++) {
    buffer.writeInt32LE(arr[i], i * 4); // Store each number as a 32-bit integer
  }
  return buffer.toString("base64"); // Convert the buffer to a base64 string
}

export function decode(encodedString: Token): number[] {
  const buffer = Buffer.from(encodedString, "base64");
  const numbers: number[] = [];
  for (let i = 0; i < buffer.length; i += 4) {
    numbers.push(buffer.readInt32LE(i)); // Read each number back
  }
  return numbers;
}
