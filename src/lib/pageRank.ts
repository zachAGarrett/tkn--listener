import { AdjacencyList } from "./buildAdjacencyList.js";
import { Token } from "./parse.js";

export function pageRank(
  adjacencyList: AdjacencyList,
  dampingFactor: number = 0.85, // Common damping factor used in PageRank
  maxIterations: number = 100,
  tolerance: number = 1e-6 // Convergence tolerance
): Map<Token, number> {
  const tokens = Array.from(adjacencyList.keys());
  const numTokens = tokens.length;

  // Initialize PageRank scores to 1 / number of tokens
  const ranks = new Map<Token, number>();
  tokens.forEach((tkn) => ranks.set(tkn, 1 / numTokens));

  // Map to store the number of outgoing links for each token
  const outDegrees = new Map<Token, number>();
  tokens.forEach((tkn) =>
    outDegrees.set(tkn, adjacencyList.get(tkn)?.length || 0)
  );

  // Iteratively calculate PageRank scores
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const newRanks = new Map<Token, number>();
    let rankChange = 0;

    tokens.forEach((tkn) => {
      let rankSum = 0;

      // Sum the rank contributions from all preceding tokens
      const precedingTokens = adjacencyList.get(tkn) || [];
      precedingTokens.forEach(({ tkn: prevTkn }) => {
        const prevRank = ranks.get(prevTkn) || 0;
        const prevOutDegree = outDegrees.get(prevTkn) || 1; // Avoid divide by zero
        rankSum += prevRank / prevOutDegree;
      });

      // Apply the damping factor and random jump
      const newRank = (1 - dampingFactor) / numTokens + dampingFactor * rankSum;
      newRanks.set(tkn, newRank);

      // Accumulate the total change in rank
      rankChange += Math.abs(newRank - (ranks.get(tkn) || 0));
    });

    // Update ranks after the iteration
    ranks.clear();
    newRanks.forEach((rank, tkn) => ranks.set(tkn, rank));

    // Check for convergence
    if (rankChange < tolerance) {
      break;
    }
  }
  return ranks;
}
