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
