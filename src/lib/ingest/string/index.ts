import chalk from "chalk";
import { cosineSimilarity, dynamicThresholdAdjustments } from "./util.js";

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
  thresholds: ReturnType<typeof dynamicThresholdAdjustments>;
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
        const centroidValues = parsed.map(
          (tkn) => bank.get(tkn)!.length / totalWeight
        );
        const currentCentroid: Centroid = {
          values: centroidValues,
        };

        // If there's a previous centroid, calculate the semantic drift
        if (previousCentroid) {
          const delta =
            1 -
            cosineSimilarity(previousCentroid.values, currentCentroid.values);
          driftDeltas.push(delta);
        }

        // Update the previous centroid
        previousCentroid = currentCentroid;
      }

      window = segment;
      newTokenCount += 1;
      windowStartIndex = index;
    }
  }

  const thresholds = dynamicThresholdAdjustments(driftDeltas, 5, 0.5, 1.5);

  process.env.VERBOSE && console.timeEnd(timer);

  return {
    bank,
    newTokenCount,
    parsed,
    driftDeltas,
    thresholds,
  };
}
