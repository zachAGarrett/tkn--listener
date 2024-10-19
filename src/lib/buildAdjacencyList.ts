import { Token } from "./parse.js";

export interface PreceedingTkn {
  tkn: Token;
  idx: number;
  rId: string;
}
export type AdjacencyList = Map<Token, PreceedingTkn[]>;
export function buildAdjacencyList(parsedCorpus: string[], runId: string) {
  const adjacencyList: AdjacencyList = new Map();

  let last: PreceedingTkn | null = null;
  parsedCorpus.forEach((tkn, idx) => {
    if (last) {
      adjacencyList.set(tkn, [...(adjacencyList.get(tkn) || []), last]);
    }
    last = { tkn, idx, rId: runId };
  });

  return adjacencyList;
}
