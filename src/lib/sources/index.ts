import { getWikipediaArticle } from "./wikipedia/getArticle.js";
import { getDocument } from "./fs/getDocument.js";
import chalk from "chalk";

export enum SourceType {
  wiki = "WIKI",
  doc = "DOC",
}
export interface Source {
  type: SourceType;
  identifier: string;
}

export async function getSource({ type, identifier }: Source, runId: string) {
  let res: Promise<{
    runId: string;
    content: string | undefined;
  }>;
  try {
    switch (type) {
      case SourceType.wiki:
        res = getWikipediaArticle(identifier, runId);
        break;
      case SourceType.doc:
        res = getDocument(identifier, runId);
        break;

      default:
        throw new Error(chalk.red("Unrecognized source type", "\n" + type));
    }
    return res;
  } catch (error) {
    console.error(error);
    res = new Promise((res) => res({ runId, content: undefined }));
    return res;
  }
}
