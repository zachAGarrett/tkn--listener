import OpenAI from "openai";
import {
  createThread,
  findOrCreateAssistant,
  getResponse,
  purgeFiles,
} from "./util.js";
import { createInterface } from "readline";
import watchAndSyncFiles from "../watchFiles/index.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
  organization: process.env.OPENAI_ORG_ID || "",
  project: process.env.OPENAI_PROJECT_ID || "",
});

type Args = [
  sourceDir: string,
  globPattern: string,
  purpose?: OpenAI.FilePurpose,
  model?: OpenAI.ChatModel
];

// Validate and destructure command line arguments
const [sourceDir, globPattern, purpose, model] = process.argv.slice(2) as Args;

if (!sourceDir || !globPattern) {
  console.error("Please provide source directory and glob pattern.");
  process.exit(1);
}

// Initialize synchronization and vector store
const { syncing: initialSyncing, vectorStoreId: initialVectorStoreId } =
  await watchAndSyncFiles({
    sourceDir,
    globPattern,
    purpose,
  });

// Use state to monitor syncing status and vector store ID
let syncing = initialSyncing;
let vectorStoreId = initialVectorStoreId;

async function monitorSyncState() {
  syncing = initialSyncing;
  vectorStoreId = initialVectorStoreId; // Update logic as needed
}

// Continuously check synchronization state
setInterval(monitorSyncState, 1000);

// Setup the assistant for handling requests
const assistant = await findOrCreateAssistant(openai, {
  name: "Programming assistant",
  description: "Helps with coding-related queries and tasks.",
  instructions:
    "You are an expert software engineer who provides code that meets the functional requirements.",
  model: model || "gpt-4o-mini",
  tools: [{ type: "file_search" }],
});

// Create a conversation thread
const thread = await createThread(openai, {
  tool_resources: { file_search: { vector_store_ids: [vectorStoreId] } },
});

// Setup readline interface for user input
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Function to handle command prompt interaction
function promptQuestion() {
  if (syncing) {
    // Inform the user of file synchronization
    console.log("Currently syncing files, please wait...");
    setTimeout(promptQuestion, 1000);
    return;
  }

  // Capture user input
  rl.question("> ", async (question) => {
    try {
      if (question === "$purge") {
        await purgeFiles({ openai });
      } else {
        const { responseContent, codeBlocks } = await getResponse({
          openai,
          threadId: thread.id,
          question,
          assistantId: assistant.id,
        });
        console.log(responseContent);

        Array.isArray(codeBlocks) &&
          codeBlocks.map((code) => console.log(code));
      }
    } catch (error) {
      console.error("An error occurred: ", error);
    } finally {
      promptQuestion();
    }
  });
}

// Begin prompting the user for questions
promptQuestion();
