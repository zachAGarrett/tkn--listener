import { RollingStats } from "../util/rollingStats.js";
import { RollingCentroid } from "./rollingCentroid.js";

export interface ChunkOptions {
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
export function chunk(
  vectors: { embedding: number[]; token: string }[],
  options: ChunkOptions
) {
  const { minChunk, k } = { ...defaultOpts, ...options };
  const chunks: string[][] = [[]];
  const chunkStats = new RollingStats();
  const centroid = new RollingCentroid(vectors[0].embedding.length);
  for (const { embedding, token } of vectors) {
    const lastCentroid = centroid.getCentroid();
    const currentCentroid = centroid.addVector(embedding).getCentroid();

    // If there's a previous centroid, calculate the semantic drift and chunk
    if (lastCentroid && currentCentroid) {
      const lastChunk = chunks[chunks.length - 1];
      const delta = 1 - cosineSimilarity(lastCentroid, currentCentroid);
      const outofRange =
        delta >
        Math.abs(chunkStats.getMean() + chunkStats.getStandardDeviation() * k);
      const minChunks = lastChunk.length >= minChunk;

      if (outofRange && minChunks) {
        chunkStats.reset();
        chunks.push([token]);
      } else {
        chunkStats.addValue(delta);
        lastChunk.push(token);
      }
    } else {
      chunks.push([token]);
    }
  }
}

function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error("Vectors must have the same length");
  }

  // Calculate dot product of vectorA and vectorB
  const dotProduct = vectorA.reduce(
    (sum, value, index) => sum + value * vectorB[index],
    0
  );

  // Calculate magnitude of vectorA
  const magnitudeA = Math.sqrt(
    vectorA.reduce((sum, value) => sum + value * value, 0)
  );

  // Calculate magnitude of vectorB
  const magnitudeB = Math.sqrt(
    vectorB.reduce((sum, value) => sum + value * value, 0)
  );

  if (magnitudeA === 0 || magnitudeB === 0) {
    throw new Error(
      "One of the vectors is a zero vector, cannot calculate cosine similarity"
    );
  }

  // Calculate cosine similarity
  return dotProduct / (magnitudeA * magnitudeB);
}
