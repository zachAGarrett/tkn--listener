import chalk from "chalk";
import { randomUUID } from "crypto";
import { readFile } from "fs/promises";

export async function getDocument(path: string, runId: string = randomUUID()) {
  const logBase = chalk.blueBright(`[${runId}]`);
  const retrievalLog = logBase + chalk.magentaBright("[RETRIEVED SOURCE]");
  const fetchStartLog = logBase + chalk.magentaBright("[FETCHING SOURCE]");

  process.env.VERBOSE && console.log(fetchStartLog);
  process.env.VERBOSE && console.time(retrievalLog);

  try {
    const res = await readFile(path, "utf-8");

    process.env.VERBOSE && console.timeEnd(retrievalLog);
    return { content: res, runId };
  } catch (error) {
    process.env.VERBOSE && console.timeEnd(retrievalLog);
    throw chalk.red("Could not read file" + "\n" + error);
  }
}
