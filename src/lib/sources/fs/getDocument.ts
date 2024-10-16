import chalk from "chalk";
import { randomUUID } from "crypto";
import { readFile } from "fs/promises";

export async function getDocument(path: string, runId: string = randomUUID()) {
  try {
    const res = await readFile(path, "utf-8");

    return { content: res, runId };
  } catch (error) {
    throw chalk.red("Could not read file" + "\n" + error);
  }
}
