import OpenAI from "openai";
import { createThread, findOrCreateAssistant } from "./util.js";
import { createInterface } from "readline";
import watchAndSyncFiles from "../watchFiles/util.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
  organization: process.env.OPENAI_ORG_ID || "",
  project: process.env.OPENAI_PROJECT_ID || "",
});

const [sourceDir, globPattern, purpose] = process.argv.slice(2);

if (!sourceDir || !globPattern) {
  console.error("Please provide source directory and glob pattern.");
  process.exit(1);
}

const vectorStoreId = await watchAndSyncFiles(
  sourceDir,
  globPattern,
  (purpose as OpenAI.FilePurpose) || "assistants"
);

const trackedFiles = await openai.beta.vectorStores.files.list(vectorStoreId);
const fileIds = trackedFiles.data.map((file) => file.id);
console.log(fileIds);
const fileNames = await Promise.all(
  fileIds.map((fileId) =>
    openai.files.retrieve(fileId).then((file) => file.filename)
  )
);
console.log(fileNames);

const assistantCreateParams: OpenAI.Beta.AssistantCreateParams = {
  name: "Programming assistant",
  description: "Helps with coding-related queries and tasks.",
  instructions:
    "You are an expert software engineer who provides code that meets the functional requirements.",
  model: "gpt-4o",
  tools: [{ type: "file_search" }],
};

const threadCreateParams: OpenAI.Beta.ThreadCreateParams = {
  tool_resources: { file_search: { vector_store_ids: [vectorStoreId] } },
};

const assistant = await findOrCreateAssistant(openai, assistantCreateParams);

const thread = await createThread(openai, threadCreateParams);

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function promptQuestion() {
  rl.question("You: ", async (question) => {
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: question,
    });

    const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: assistant.id,
    });
    if (run.status === "completed") {
      const messagesPage = await openai.beta.threads.messages.list(thread.id);
      const lastMessage = messagesPage.data[0].content[0];
      console.log(lastMessage.type === "text" && lastMessage.text);
    }

    promptQuestion(); // Recursively ask for the next input
  });
}

promptQuestion();
