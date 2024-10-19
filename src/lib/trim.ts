import chalk from "chalk";
import { RollingStats } from "../util/rollingStats.js";
import { AdjacencyList } from "./buildAdjacencyList.js";
import { pageRank } from "./pageRank.js"; // Assuming you have the pageRank function implemented

export function trim(
  adjacencyList: AdjacencyList,
  k: number = 1,
  runId: string
) {
  const stats = new RollingStats();
  const ranks = pageRank(adjacencyList); // Calculate PageRank for all tokens

  // Add PageRank values to RollingStats to calculate mean and standard deviation
  ranks.forEach((rank) => stats.addValue(rank));

  const std = stats.getStandardDeviation();
  const mean = stats.getMean();

  const trimThreshold = mean + k * std;

  ranks.forEach((rank, tkn) => {
    if (rank < trimThreshold) {
      adjacencyList.delete(tkn);
    }
  });

  // Rebuild adjacency list with filtered tokens
  adjacencyList.forEach((pTkns, tkn) => {
    const qualifiedPrecedingTkns = pTkns.filter(({ tkn: prevTkn }) =>
      adjacencyList.has(prevTkn)
    );
    adjacencyList.set(tkn, qualifiedPrecedingTkns);
  });

  // Log results if in verbose mode
  process.env.VERBOSE?.toLowerCase() === "true" &&
    console.log(
      chalk.yellowBright("[PARSING]") +
        chalk.blueBright(`[${runId}]`) +
        chalk.magentaBright(
          "[TRIMMED MEMORY SIZE]",
          chalk.white(adjacencyList.size + " tkns")
        )
    );
}
