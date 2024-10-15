import { max, mean, std } from "mathjs";
import { TokenBank } from "./index.js";

/**
 * Class to maintain running statistics (mean, variance, standard deviation) dynamically.
 */
export class RunningStats {
  private n: number; // Number of elements
  private mean: number; // Mean of elements
  private M2: number; // Sum of squares of differences from the current mean
  private nullCount: number; // Number of empty values in the set
  private max: number; // Maximum occurences

  constructor() {
    this.n = 0;
    this.mean = 0;
    this.M2 = 0;
    this.nullCount = 0;
    this.max = 0;
  }

  /**
   * Adds a value to the running statistics, updating mean and M2.
   * @param x - The value to add.
   */
  addValue(x: number) {
    this.n += 1;
    const delta = x - this.mean;
    this.mean += delta / this.n;
    const delta2 = x - this.mean;
    this.M2 += delta * delta2;
    if (x === 0) {
      this.nullCount += 1;
    }
    if (x > this.max) {
      this.max = x;
    }
  }

  /**
   * Gets the current mean of the values.
   * @returns The mean.
   */
  getMean(): number {
    return this.mean;
  }

  /**
   * Gets the current max of the values.
   * @returns The max.
   */
  getMax(): number {
    return this.max;
  }

  /**
   * Gets the current number of the values with a value equal to zero.
   * @returns The null count.
   */
  getNullCount(): number {
    return this.nullCount;
  }

  /**
   * Gets the variance of the values.
   * @returns The variance.
   */
  getVariance(): number {
    return this.n > 1 ? this.M2 / (this.n - 1) : 0;
  }

  /**
   * Gets the standard deviation of the values.
   * @returns The standard deviation.
   */
  getStandardDeviation(): number {
    return Math.sqrt(this.getVariance());
  }
}

export function buildPositionIndex(tokenBank: TokenBank) {
  const positionIndex = new Map<number, string>();
  tokenBank.forEach((indices, tkn) => {
    if (indices.length === 0) {
      return;
    } else {
      for (const i of indices) {
        positionIndex.set(i, tkn);
      }
    }
  });
  return positionIndex;
}

export function buildAdjacencyList(
  tokenBank: TokenBank,
  positionIndex: ReturnType<typeof buildPositionIndex>
) {
  {
    const adjacency = new Map<string, Set<string>>();
    tokenBank.forEach((indices, tkn) => {
      indices.forEach((i) => {
        const lastToken = positionIndex.get(i - 1);
        const nextToken = positionIndex.get(i + 1);
        if (!adjacency.has(tkn)) {
          adjacency.set(tkn, new Set<string>());
        }
        // Add adjacent tokens to the adjacency set
        lastToken && adjacency.get(tkn)!.add(lastToken);
        nextToken && adjacency.get(tkn)!.add(nextToken);
      });
    });
    return adjacency;
  }
}

/**
 * Profiles a TokenBank by calculating various statistics about token lengths.
 * @param tokenBank - A collection of tokens and their respective positions.
 * @returns An object containing the size of the token bank and statistics on token lengths.
 */
export const profileTokenBank = (tokenBank: TokenBank) => {
  const tokens = Array.from(tokenBank.keys());
  const tokenLengths = tokens.map((token) => token.length);

  return {
    bankSize: tokens.length, // Total number of unique tokens
    tokenLengthMean: mean(tokenLengths), // Average token length
    tokenLengthStd: std(tokenLengths), // Standard deviation of token lengths
    tokenLengthMax: max(tokenLengths), // Maximum token length
  };
};

export function decode(
  bank: TokenBank,
  low: number,
  high: number,
  encodedValue: number,
  totalTokens: number
): string[] {
  const decodedTokens: string[] = [];
  let currentToken: string | undefined;

  // Create a frequency map from the TokenBank
  const frequencies = Array.from(bank.entries()).map(([token, indices]) => {
    const tokenFrequency = indices.length;
    return { token, frequency: tokenFrequency };
  });

  // Calculate total frequency for normalization
  const totalFrequency = frequencies.reduce(
    (sum, { frequency }) => sum + frequency,
    0
  );

  while (true) {
    let range = high - low;

    // Iterate through the frequencies to find the token corresponding to the encoded value
    let cumulativeFrequency = 0;
    for (const { token, frequency } of frequencies) {
      const prob = frequency / totalFrequency;
      const upperBound = low + range * cumulativeFrequency;
      const lowerBound = low + range * (cumulativeFrequency + prob);

      if (encodedValue >= lowerBound && encodedValue < upperBound) {
        currentToken = token;
        decodedTokens.push(currentToken);

        // Update the range based on the found token
        high = upperBound;
        low = lowerBound;

        // Update the frequency of the token in the bank
        bank.set(currentToken, (bank.get(currentToken) || []).slice(0, -1));

        // Break to re-evaluate range for the next token
        break;
      }
      cumulativeFrequency += prob;
    }

    // Stop condition (e.g., reaching a certain length or a terminating symbol)
    if (currentToken === undefined || decodedTokens.length >= totalTokens) {
      break;
    }
  }

  return decodedTokens;
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dotProduct = vecA.reduce((sum, val, idx) => sum + val * vecB[idx], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));

  // Return cosine similarity, ensuring no division by zero
  return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0;
}
