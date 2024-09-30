import { TokenBank } from "@/lib/ingest/string/index.js";
import { max, mean, std } from "mathjs";

export const profileTokenBank = (tokenBank: TokenBank) => {
  const tkns = Object.keys(tokenBank);
  const tknLengths = tkns.map((k) => k.length);

  const profile = {
    size: tkns.length,
    mean: mean(tknLengths),
    std: std(tknLengths),
    max: max(tknLengths),
  };

  return profile;
};

export const calculateCycleGrowth = (
  previousBank: TokenBank,
  currentBank: TokenBank
) => {
  const previouslyKnownTokenSetSize = Object.keys(previousBank).length;
  const resultingTokenSetSize = Object.keys(currentBank).length;
  return (
    ((resultingTokenSetSize - previouslyKnownTokenSetSize) /
      previouslyKnownTokenSetSize) *
    100
  );
};

export function trimTokenBank(tokenBank: TokenBank): TokenBank {
  // Get all tokens
  const tokens = Object.keys(tokenBank);

  // Calculate token lengths
  const tokenLengths = tokens.map((token) => token.length);

  // Calculate mean and standard deviation of token lengths
  const meanLength = mean(tokenLengths);
  const stdDevLength = std(tokenLengths);

  // Calculate the cutoff length (mean + 1 standard deviation)
  const cutoffLength = meanLength + Number(stdDevLength);

  // Create a new TokenBank with trimmed tokens
  const trimmedTokenBank: TokenBank = {};

  for (const token of tokens) {
    if (token.length <= cutoffLength) {
      trimmedTokenBank[token] = tokenBank[token];
    }
  }

  return trimmedTokenBank;
}
