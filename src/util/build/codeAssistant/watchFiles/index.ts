import OpenAI from "openai";
import watchAndSyncFiles from "./util.js";

const [sourceDir, globPattern, purpose] = process.argv.slice(2);

if (!sourceDir || !globPattern) {
  console.error("Please provide source directory and glob pattern.");
  process.exit(1); 
}

await watchAndSyncFiles(
  sourceDir,
  globPattern,
  (purpose as OpenAI.FilePurpose) || "assistants"
);
