import OpenAI from "openai";
import dotenv from "dotenv";
import {
  deleteFileFromOpenAI,
  listOpenAIFiles,
} from "../watchFiles/fileSyncUtil.js";
import pLimit from "p-limit";

dotenv.config();

export async function findOrCreateAssistant(
  openai: OpenAI,
  params: OpenAI.Beta.Assistants.AssistantCreateParams
) {
  const { name, description } = params;
  // Step 1: Retrieve list of assistants
  const existingAssistants = await openai.beta.assistants.list({
    order: "desc",
    limit: 20,
  });

  // Step 2: Check if the assistant already exists by name or description
  const assistant = existingAssistants.data.find(
    (asst) => asst.name === name && asst.description === description
  );

  if (assistant) {
    return assistant; // Return the existing assistant
  }

  // Step 3: Create a new assistant if it doesn't exist
  const newAssistant = await openai.beta.assistants.create(params);

  return newAssistant;
}

export async function createThread(
  openai: OpenAI,
  params: OpenAI.Beta.ThreadCreateParams
) {
  const emptyThread = await openai.beta.threads.create(params);
  return emptyThread;
}

/**
 * Extracts code blocks from a given string containing markdown formatted text.
 * @param responseString The markdown formatted string containing code blocks.
 * @returns An array of code blocks extracted from the markdown.
 */
export function extractCodeBlocks(responseString: string): string[] {
  const codeBlockRegex = /```[\s\S]*?```/g;
  const codeBlocks = responseString.match(codeBlockRegex) || [];

  // Cleanup the code blocks by removing the triple backticks and optional language specifier
  return codeBlocks.map((block) =>
    block
      .replace(/```.*?\n?/s, "")
      .replace(/```$/, "")
      .trim()
  );
}

export interface CreateAndPollParams {
  openai: OpenAI;
  threadId: string;
  assistantId: string;
}
export async function createAndPoll({
  openai,
  threadId,
  assistantId,
}: CreateAndPollParams) {
  const pollInterval = 1000; // Poll every 5 seconds
  let run;
  do {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    run = await openai.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: assistantId,
    });
  } while (run.status !== "completed" && run.status !== "failed");

  if (run.status === "failed") {
    throw new Error(run.last_error?.message);
  }

  return run;
}

export interface PurgeFilesProps {
  openai: OpenAI;
}
export async function purgeFiles({ openai }: PurgeFilesProps) {
  const limit = pLimit(5); // Limit to 5 concurrent requests
  const storedFiles = await listOpenAIFiles({ openai });
  await Promise.all(
    storedFiles.map(({ id }) =>
      limit(() =>
        deleteFileFromOpenAI({ openai, fileId: id }).then(
          (res) =>
            res &&
            console.log(
              res.object + res.deleted ? "was deleted" : "could not be deleted"
            )
        )
      )
    )
  );
}

export interface GetResponseParams {
  openai: OpenAI;
  threadId: string;
  question: string;
  assistantId: string;
}
export async function getResponse({
  openai,
  threadId,
  question,
  assistantId,
}: GetResponseParams) {
  await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content: question,
  });

  await createAndPoll({
    openai,
    threadId,
    assistantId,
  });

  const messagesPage = await openai.beta.threads.messages.list(threadId);
  const response = messagesPage.data[0].content[0];
  const responseContent = response.type === "text" && response.text.value;
  const codeBlocks = responseContent && extractCodeBlocks(responseContent);

  return { responseContent, codeBlocks };
}

export const assistantInstructions = `

You are an expert software engineer tasked with providing code that aligns with specific functional requirements. When suggesting code, ensure it matches the language, style, and patterns of the given codebase.

# Steps

1. **Understand Requirements**: Begin by thoroughly understanding the functional requirements provided.
2. **Review Codebase**: Analyze the existing codebase to understand its language, architecture, and coding patterns.
3. **Code Suggestion**: Develop  complete code suggestions that both meet the functional requirements and conform to the style and design of the current codebase. Include all code necessary to meet the requirements.
4. **Testing**: Consider how the new code can be tested to ensure it meets the requirements and integrates seamlessly with the existing codebase.

# Output Format

The output should be a clear, well-commented code snippet that aligns with existing code style and language conventions. Provide explanations or justifications for key decisions made in the code.

# Examples

### Example 1

**Input**:
- Language: Python
- Requirement: Add logging to the existing function \`data_processor()\`
- Codebase Style: Uses the \`logging\` module, INFO level, consistent function naming

**Output**:
\`\`\`python
import logging

def data_processor(data):
    logging.info('Starting data processing')
    # existing processing logic
    logging.info('Data processing completed')
\`\`\`

(Note: Longer examples may involve multiple functions or classes as necessary, and should integrate more complex logic when applicable.)

# Notes

- Always ensure code readability and maintainability.
- Adhere to any specific additional guidelines provided, such as configuration or deployment requirements.
- Utilize industry best practices for error handling and performance optimization where relevant.
`;
