import chalk from "chalk";
import { cosineSimilarity } from "./util.js";

export type TokenBank = Map<string, Array<number>>;
export type Centroid = { values: number[] };

export function ingest(
  input: string,
  bank: TokenBank = new Map(),
  runId: string
): {
  bank: TokenBank;
  newTokenCount: number;
  parsed: string[];
  driftDeltas: number[];
} {
  const timer =
    chalk.blueBright(`[${runId}]`) + chalk.magentaBright("[PARSED]");
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const graphemes = segmenter.segment(input);
  const driftDeltas: number[] = [];
  const parsed: string[] = [];
  let previousCentroid: Centroid | null = null; // To store the previous centroid
  let window: string = "";
  let windowStartIndex: number = 0;
  let newTokenCount: number = 0;
  let totalWeight = 0;

  process.env.VERBOSE && console.time(timer);
  for (const { segment, index } of graphemes) {
    const tkn = window + segment;
    const existingIndices = bank.get(tkn);
    if (existingIndices !== undefined) {
      window = tkn;
    } else {
      bank.set(tkn, []);

      if (window !== "") {
        const updatedIndices = [...(bank.get(window) || []), windowStartIndex];
        bank.set(window, updatedIndices);

        parsed.push(window);

        // Calculate and store the centroid for the current window
        totalWeight = totalWeight + updatedIndices.length;
        const currentCentroid: Centroid = {
          values: (previousCentroid?.values || []).concat(
            updatedIndices.length / totalWeight
          ),
        };

        // If there's a previous centroid, calculate the semantic drift
        if (previousCentroid) {
          const drift = cosineSimilarity(
            previousCentroid.values,
            currentCentroid.values
          );
          driftDeltas.push(drift);
        }

        // Update the previous centroid
        previousCentroid = currentCentroid;
      }

      window = segment;
      newTokenCount += 1;
      windowStartIndex = index;
    }
  }
  process.env.VERBOSE && console.timeEnd(timer);

  return {
    bank,
    newTokenCount,
    parsed,
    driftDeltas,
  };
}
