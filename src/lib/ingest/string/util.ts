import { max, mean, std } from "mathjs";
import { TokenBank } from "./index.js";

// Define a type for the centrality map, which maps tokens to their centrality score
type CentralityMap = Map<string, number>;

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

/**
 * Builds a centrality map for the given TokenBank.
 * @param tokenBank - The TokenBank to analyze.
 * @returns A map of tokens and their calculated centrality values.
 */
function buildCentralityMap(tokenBank: TokenBank): CentralityMap {
  // Index tokens by their positions to facilitate adjacency logic
  const positionIndex = (() => {
    const index = new Map<number, string>();
    for (const [token, indicesStr] of tokenBank.entries()) {
      const indices = indicesStr.split("|").map(Number);
      for (const i of indices) {
        index.set(i, token);
      }
    }
    return index;
  })();

  // Build adjacency list from the position index
  const adjacencyList = (() => {
    const adjacency = new Map<string, Set<string>>();
    for (const [token, indicesStr] of tokenBank.entries()) {
      const indices = indicesStr.split("|").map(Number);
      indices.forEach((i) => {
        const lastToken = positionIndex.get(i - 1);
        const nextToken = positionIndex.get(i + 1);
        if (!adjacency.has(token)) {
          adjacency.set(token, new Set<string>());
        }
        // Add adjacent tokens to the adjacency set
        lastToken && adjacency.get(token)!.add(lastToken);
        nextToken && adjacency.get(token)!.add(nextToken);
      });
    }
    return adjacency;
  })();

  return computeCentrality(adjacencyList);
}

/**
 * Computes the centrality of each token based on its adjacency list.
 * @param adjacencyList - Mapping of tokens to their direct neighbors.
 * @returns A centrality map where each token's centrality is its adjacency size.
 */
function computeCentrality(
  adjacencyList: Map<string, Set<string>>
): CentralityMap {
  const centralityMap = new Map<string, number>();

  adjacencyList.forEach((neighbors, token) => {
    centralityMap.set(token, neighbors.size);
  });

  return centralityMap;
}

/**
 * Trims the TokenBank by removing tokens with low centrality.
 * @param tokenBank - The TokenBank to trim.
 * @returns A trimmed version of the TokenBank.
 */
export function trimTokenBank({
  tokenBank,
}: {
  tokenBank: TokenBank;
}): TokenBank {
  console.log("Trimming token bank");
  console.time("Trimmed in");

  const stats = new RunningStats();
  const centralityMap = buildCentralityMap(tokenBank);

  centralityMap.forEach((value) => stats.addValue(value));

  const threshold = stats.getMean() + stats.getStandardDeviation();

  // Filter tokens with centrality above the calculated threshold
  const trimmedBank = new Map<string, string>(
    [...centralityMap.entries()]
      .filter(([, centrality]) => centrality >= threshold)
      .map(([token]) => [token, tokenBank.get(token)!])
  );

  console.timeEnd("Trimmed in");
  process.env.VERBOSE &&
    console.log(
      "Bank:",
      JSON.stringify(profileTokenBank(trimmedBank), undefined, 2)
    );

  return trimmedBank;
}

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
