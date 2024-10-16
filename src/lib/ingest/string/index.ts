import chalk from "chalk";
import { cosineSimilarity, RunningStats } from "./util.js";

export type TokenBank = Map<string, Array<number>>;
export type Centroid = { values: number[]; totalWeight: number };
export interface IngestOptions {
  minChunk?: number;
  k?: number;
  a?: number;
  b?: number;
}
const defaultOpts = {
  minChunk: 10,
  k: 1,
  a: 0.5,
  b: 1.5,
};
export function ingest(
  input: string,
  bank: TokenBank = new Map(),
  runId: string,
  opts: IngestOptions = {}
): {
  bank: TokenBank;
  newTokenCount: number;
  driftDeltas: number[];
  chunks: string[][];
} {
  const { minChunk, k, a, b } = { ...defaultOpts, ...opts };
  const timer =
    chalk.blueBright(`[${runId}]`) + chalk.magentaBright("[PARSED]");
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const graphemes = segmenter.segment(input);
  const driftDeltas: number[] = [];
  const chunks: string[][] = [[]];
  const chunkStats = new RunningStats();
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

        // If there's a previous centroid, calculate the semantic drift and chunk
        if (previousCentroid) {
          const lastChunk = chunks[chunks.length - 1];
          const delta = 1 - cosineSimilarity(previousCentroid, currentCentroid);
          const outofRange =
            delta >
            Math.abs(
              chunkStats.getMean() + chunkStats.getStandardDeviation() * k
            );
          const minChunks = lastChunk.length >= minChunk;

          // console.log(
          //   chunkStats.getMean(),
          //   chunkStats.getStandardDeviation() * k
          // );

          if (outofRange && minChunks) {
            chunkStats.reset();
            chunks.push([window]);
          } else {
            chunkStats.addValue(delta);
            lastChunk.push(window);
          }
          driftDeltas.push(delta);
        } else {
          chunks.push([window]);
        }

        // Update the previous centroid
        previousCentroid = currentCentroid;
        bank.set(window, updatedIndices);
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
    driftDeltas,
    chunks,
  };
}
