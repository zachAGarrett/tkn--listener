import chalk from "chalk";
import { RollingStats } from "./rollingStats.js";
import { AdjacencyList } from "./buildAdjacencyList.js";

export function trim(
  adjacencyList: AdjacencyList,
  k: number = 1,
  runId: string
) {
  const logBase =
    chalk.yellowBright("[PARSING]") + chalk.blueBright(`[${runId}]`);
  const stats = new RollingStats();
  let std: number;
  let mean: number;

  const timer = logBase + chalk.magentaBright("[TRIMMED MEMORY]");
  process.env.VERBOSE && console.time(timer);

  process.env.VERBOSE &&
    console.log(
      logBase +
        chalk.magentaBright(
          "[MEMORY SIZE]",
          chalk.white(adjacencyList.size + "tkns")
        )
    );

  adjacencyList.forEach((pTkns) => {
    stats.addValue(pTkns.length);
  });

  std = stats.getStandardDeviation();
  mean = stats.getMean();

  // Trim the tokens with low confidence
  adjacencyList.forEach((pTkns, tkn) => {
    if (pTkns.length <= mean + std * k) {
      adjacencyList.delete(tkn);
    }
  });

  adjacencyList.forEach((pTkns, tkn) => {
    const qualifiedPrecedingTkns = pTkns.filter(({ tkn }) =>
      adjacencyList.has(tkn)
    );
    adjacencyList.set(tkn, qualifiedPrecedingTkns);
  });

  console.timeEnd(timer);
  process.env.VERBOSE &&
    console.log(
      logBase +
        chalk.magentaBright(
          "[MEMORY SIZE]",
          chalk.white(adjacencyList.size + "tkns")
        )
    );
}
