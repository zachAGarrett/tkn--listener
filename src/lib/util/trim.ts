import chalk from "chalk";
import { RollingStats } from "./rollingStats.js";
import { TokenBank } from "./tokenBank.js";

export async function trim(memory: TokenBank) {
  const stats = new RollingStats();
  let std: number;
  let mean: number;
  let nullCounter: number;

  const timer = chalk.magentaBright("[TRIMMED MEMORY]");
  process.env.VERBOSE && console.time(timer);

  process.env.VERBOSE &&
    console.log(
      chalk.magentaBright("[MEMORY SIZE]", chalk.white(memory.size + "tkns"))
    );

  // Profile the memory
  memory.forEach((v, k) => {
    const appearances = v.split("|").filter(Boolean).length;
    if (appearances === 0) {
      memory.delete(k);
      nullCounter += 1;
    } else {
      stats.addValue(appearances);
    }
  });

  std = stats.getStandardDeviation();
  mean = stats.getMean();

  // Trim the tokens with low confidence
  memory.forEach((v, k) => {
    const appearances = v.split("|").filter(Boolean).length;
    if (appearances <= mean - std) {
      memory.delete(k);
    }
  });
  console.timeEnd(timer);
}
