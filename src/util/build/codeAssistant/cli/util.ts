import OpenAI from "openai";
import dotenv from "dotenv";

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
