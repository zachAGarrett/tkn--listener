import path from "path";
import OpenAI from "openai";
import watch from "glob-watcher";
import { glob } from "glob";
import dotenv from "dotenv";
import pLimit from "p-limit";
import {
  addFileToVectorStore,
  deleteVectorStoreFile,
  findOrCreateVectorStore,
  listVectorStoreFiles,
} from "./vectorStoreUtil.js";
import {
  deleteFileFromOpenAI,
  findFileInOpenAIByFilename,
  uploadFileToOpenAI,
} from "./fileSyncUtil.js";
import { watchFilesAndCopy } from "./collectFiles.js";
dotenv.config();

// Initialize OpenAI client with credentials from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
  organization: process.env.OPENAI_ORG_ID || "",
  project: process.env.OPENAI_PROJECT_ID || "",
});

// Watch files in the specified directory and sync with OpenAI.
// Handles additions, changes, and deletions of files in real-time.
export interface WatchAndSyncFilesParams {
  sourceDir: string;
  globPattern: string;
  purpose?: OpenAI.FilePurpose;
  model?: OpenAI.ChatModel;
  vectorStoreName?: string;
  quiet?: boolean;
  tempDir?: string;
}
export default async function watchAndSyncFiles({
  sourceDir,
  globPattern,
  purpose = "assistants",
  vectorStoreName = "Programming Assistant Vector Store",
  quiet = true,
  tempDir = "./files",
}: WatchAndSyncFilesParams) {
  // Copy all files in the target to the temp directory
  await watchFilesAndCopy(sourceDir, tempDir, globPattern);

  // Resolve full path pattern for files to watch
  const fullGlobPattern = path.join(tempDir, globPattern).replace(/\\/g, "/");

  // Find or create a vector store to store files
  const vectorStore = await findOrCreateVectorStore({
    openai,
    vectorStoreName,
  });
  if (!vectorStore) throw new Error("Vector store was not instantiated");

  !quiet &&
    console.log(`Using vector store ${vectorStore.name} | ${vectorStore.id}`);

  // Map to track synced files (local file ID -> vector store file ID)
  const files: Map<string, string> = new Map();

  // Initial sync: find all files in the temp directory that match the glob pattern
  const matchedFiles = await glob(fullGlobPattern);

  const limit = pLimit(5); // Limit to 5 concurrent requests
  // Process each file found during initial sync
  let syncing = true;
  console.log(`Ensuring ${matchedFiles.length} project files are synced...`);
  await Promise.all(
    matchedFiles.map((filePath) =>
      limit(async () => {
        !quiet && console.log(`Initial sync file: ${filePath}`);
        const filename = path.basename(filePath);

        // Check if the file already exists in OpenAI
        const existingFile = await findFileInOpenAIByFilename({
          openai,
          filename,
        });

        // If the file does not exist, upload it to OpenAI and add to the vector store
        if (!existingFile) {
          console.log(`${filename} was new`);
          const fileId = await uploadFileToOpenAI({
            filePath,
            purpose,
            openai,
          });
          if (fileId) {
            const vectorFileId = await addFileToVectorStore({
              vectorStoreId: vectorStore.id,
              fileId,
              openai,
            });
            files.set(fileId, vectorFileId);
            console.log(`${filename} successfully synced.`);
          }
        } else {
          // Check if the file is already in the vector store
          const vectorStoreFiles = await listVectorStoreFiles({
            vectorStoreId: vectorStore.id,
            openai,
          });
          if (!vectorStoreFiles.data.some(({ id }) => id === existingFile.id)) {
            const vectorFileId = await addFileToVectorStore({
              vectorStoreId: vectorStore.id,
              fileId: existingFile.id,
              openai,
            });
            files.set(existingFile.id, vectorFileId);
          }
        }
      })
    )
  );
  syncing = false;
  console.log(`Successfully synced ${matchedFiles.length} project files.`);

  // Initialize file watcher to detect additions, changes, and deletions
  const watcher = watch(fullGlobPattern);

  // Watcher event: file addition
  watcher.on("add", async (filePath: string) => {
    syncing = true;
    console.log(`File added: ${filePath}`);
    const filename = path.basename(filePath);

    // Check if the file exists in OpenAI and handle accordingly
    const existingFile = await findFileInOpenAIByFilename({ openai, filename });
    if (!existingFile) {
      const fileId = await uploadFileToOpenAI({ filePath, purpose, openai });
      if (fileId) {
        const vectorFileId = await addFileToVectorStore({
          openai,
          vectorStoreId: vectorStore.id,
          fileId,
        });
        files.set(fileId, vectorFileId);
        console.log(`${filename} was updated in the assistant's memory.`);
      }
    } else {
      const vectorStoreFiles = await listVectorStoreFiles({
        vectorStoreId: vectorStore.id,
        openai,
      });
      if (!vectorStoreFiles.data.some(({ id }) => id === existingFile.id)) {
        const vectorFileId = await addFileToVectorStore({
          vectorStoreId: vectorStore.id,
          fileId: existingFile.id,
          openai,
        });
        files.set(existingFile.id, vectorFileId);
      }
    }
    syncing = false;
  });

  // Watcher event: file change
  watcher.on("change", async (filePath: string) => {
    syncing = true;
    console.log(`${filePath} was modified.`);
    const filename = path.basename(filePath);

    // If file exists, delete old version and upload new version
    const existingFile = await findFileInOpenAIByFilename({ openai, filename });
    if (existingFile) {
      await deleteFileFromOpenAI({ fileId: existingFile.id, openai });

      const vectorStoreFiles = await listVectorStoreFiles({
        openai,
        vectorStoreId: vectorStore.id,
      });
      if (vectorStoreFiles.data.some(({ id }) => id === existingFile.id)) {
        await deleteVectorStoreFile({
          vectorStoreId: vectorStore.id,
          fileId: existingFile.id,
          openai,
        });
      }
    }

    const fileId = await uploadFileToOpenAI({ openai, filePath, purpose });
    if (fileId) {
      const vectorFileId = await addFileToVectorStore({
        vectorStoreId: vectorStore.id,
        fileId,
        openai,
      });
      files.set(fileId, vectorFileId);
      console.log(`Memory updated with latest ${filename}.`);
    }
    syncing = false;
  });

  // Watcher event: file deletion
  watcher.on("unlink", async (filePath: string) => {
    syncing = true;
    console.log(`${filePath} was removed`);
    const filename = path.basename(filePath);

    // If the file exists, remove it from OpenAI and the vector store
    const existingFile = await findFileInOpenAIByFilename({ filename, openai });
    if (existingFile) {
      await deleteFileFromOpenAI({ fileId: existingFile.id, openai });

      const vectorStoreFiles = await listVectorStoreFiles({
        vectorStoreId: vectorStore.id,
        openai,
      });
      if (vectorStoreFiles.data.some(({ id }) => id === existingFile.id)) {
        await deleteVectorStoreFile({
          vectorStoreId: vectorStore.id,
          fileId: existingFile.id,
          openai,
        });
      }

      files.delete(existingFile.id);
    }
    syncing = false;
  });

  console.log(`Watching files matching: ${fullGlobPattern}`);

  return { watcher, syncing, vectorStoreId: vectorStore.id };
}
