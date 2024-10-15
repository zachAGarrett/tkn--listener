import chalk from "chalk";
import { cosineSimilarity, dynamicThresholdAdjustments } from "./util.js";

export type TokenBank = Map<string, Array<number>>;
export type Centroid = { values: number[]; totalWeight: number };

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
  chunks: string[][];
} {
  const timer =
    chalk.blueBright(`[${runId}]`) + chalk.magentaBright("[PARSED]");
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const graphemes = segmenter.segment(input);
  const driftDeltas: number[] = [];
  const parsed: string[] = [];
  const chunks: string[][] = [];
  let previousCentroid: Centroid | null = null;
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

        // Calculate and store the centroid for the current window
        totalWeight = totalWeight + updatedIndices.length;
        const currentCentroid: Centroid = {
          values: [...(previousCentroid?.values || []), updatedIndices.length],
          totalWeight,
        };

        // If there's a previous centroid, calculate the semantic drift
        if (previousCentroid) {
          const delta = 1 - cosineSimilarity(previousCentroid, currentCentroid);
          driftDeltas.push(delta);
        }

        // Update the previous centroid
        previousCentroid = currentCentroid;
        bank.set(window, updatedIndices);
        parsed.push(window);
      }

      window = segment;
      newTokenCount += 1;
      windowStartIndex = index;
    }
  }

  const thresholds = dynamicThresholdAdjustments(driftDeltas, 5, 0.5, 1.5);

  // Chunk the parsed array based on drift deltas exceeding shift threshold
  let chunkStartIndex = 0;
  for (let i = 0; i < driftDeltas.length; i++) {
    if (driftDeltas[i] > thresholds[i].shiftThreshold) {
      // If a shift is detected, create a new chunk
      const chunk = parsed.slice(chunkStartIndex, i + 1);
      chunks.push(chunk);
      chunkStartIndex = i + 1; // Move start index to the next token after the split
    }
  }
  // Add the last chunk
  if (chunkStartIndex < parsed.length) {
    const chunk = parsed.slice(chunkStartIndex);
    chunks.push(chunk);
  }

  process.env.VERBOSE && console.timeEnd(timer);

  return {
    bank,
    newTokenCount,
    parsed,
    driftDeltas,
    thresholds,
    chunks,
  };
}
