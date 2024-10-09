import fs from "fs";
import path from "path";
import OpenAI from "openai";
import watch from "glob-watcher";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
  organization: process.env.OPENAI_ORG_ID || "",
  project: process.env.OPENAI_PROJECT_ID || "",
});

// Upload a file to OpenAI with the document path comment
async function uploadFileToOpenAI(
  filePath: string,
  purpose: OpenAI.FilePurpose = "assistants"
) {
  try {
    const filePathComment = `// Document path: ${filePath}\n`;
    const fileStream = fs.createReadStream(filePath);
    fileStream.push(filePathComment);
    const file = await openai.files.create({
      file: fileStream,
      purpose: purpose,
    });
    return file.id;
  } catch (error: any) {
    console.error(`Error uploading file ${filePath}: ${error.message}`);
  }
}

async function addFileToVectorStore(vectorStoreId: string, fileId: string) {
  const myVectorStoreFile = await openai.beta.vectorStores.files.create(
    vectorStoreId,
    {
      file_id: fileId,
    }
  );
  return myVectorStoreFile.id;
}

// Delete a file from OpenAI
async function deleteFileFromOpenAI(fileId: string) {
  try {
    const response = await openai.files.del(fileId);
    return response;
  } catch (error: any) {
    console.error(`Error deleting file ${fileId}: ${error.message}`);
  }
}
async function deleteVectorStoreFile(vectorStoreId: string, fileId: string) {
  return await openai.beta.vectorStores.files.del(vectorStoreId, fileId);
}

// List files from OpenAI
async function listOpenAIFiles() {
  try {
    const fileList = await openai.files.list();
    return fileList.data;
  } catch (error: any) {
    console.error(`Error listing files: ${error.message}`);
    return [];
  }
}

async function listVectorStoreFiles(vectorStoreId: string) {
  const vectorStoreFiles = await openai.beta.vectorStores.files.list(
    vectorStoreId
  );
  return vectorStoreFiles;
}

// Find file by local filename in OpenAI files
async function findFileInOpenAIByFilename(filename: string) {
  const files = await listOpenAIFiles();
  return files.find((file: any) => file.filename === filename);
}

// Create a vector store
async function findOrCreateVectorStore(vectorStoreName: string) {
  try {
    let vectorStore: OpenAI.Beta.VectorStore | null = null;
    const existingVectorStores = await openai.beta.vectorStores.list();
    const matchedVectorStore = existingVectorStores.data.find(
      ({ name }) => name === vectorStoreName
    );
    if (matchedVectorStore) {
      vectorStore = await openai.beta.vectorStores.retrieve(
        matchedVectorStore.id
      );
    } else {
      vectorStore = await openai.beta.vectorStores.create({
        name: vectorStoreName,
      });
    }
    return vectorStore;
  } catch (error: any) {
    console.error(`Error instantiating vector store: ${error.message}`);
  }
}

// Watch files and sync with OpenAI
export default async function watchAndSyncFiles(
  sourceDir: string,
  globPattern: string,
  purpose: OpenAI.FilePurpose = "assistants",
  vectorStoreName: string = "Programming Assistant Vector Store",
  quiet: boolean = true
) {
  const fullGlobPattern = path.join(sourceDir, globPattern).replace(/\\/g, "/");

  const watcher = watch(fullGlobPattern, { ignoreInitial: false });

  const vectorStore = await findOrCreateVectorStore(vectorStoreName);
  if (vectorStore === undefined) throw "vector store was not instantiated"; // vector store must be successfully instantiated to proceed
  !quiet &&
    console.log(`Using vector store ${vectorStore.name} | ${vectorStore.id}`);

  const files: Map<string, string> = new Map();

  // Handle new or changed files
  watcher.on("add", async (filePath: string) => {
    !quiet && console.log(`File added: ${filePath}`);
    const filename = path.basename(filePath);
    const existingFile = await findFileInOpenAIByFilename(filename);
    if (!existingFile) {
      const fileId = await uploadFileToOpenAI(filePath, purpose);
      if (fileId) {
        const vectorFileId = await addFileToVectorStore(vectorStore.id, fileId);
        files.set(fileId, vectorFileId);
        console.log(`Memory updated to include ${filename}.`);
      }
    } else {
      !quiet && console.log(`File ${filename} already exists in OpenAI.`);
      const existingVectorStoreFiles = await listVectorStoreFiles(
        vectorStore.id
      );
      if (
        existingVectorStoreFiles.data.some(({ id }) => id === existingFile.id)
      ) {
        !quiet &&
          console.log(`File ${filename} already exists in Vector Store.`);
      } else {
        const vectorFileId = await addFileToVectorStore(
          vectorStore.id,
          existingFile.id
        );
        files.set(existingFile.id, vectorFileId);
      }
    }
  });

  watcher.on("change", async (filePath: string) => {
    !quiet && console.log(`File changed: ${filePath}`);
    const filename = path.basename(filePath);
    const existingFile = await findFileInOpenAIByFilename(filename);
    if (existingFile) {
      await deleteFileFromOpenAI(existingFile.id);
      const existingVectorStoreFiles = await listVectorStoreFiles(
        vectorStore.id
      );
      if (
        existingVectorStoreFiles.data.some(({ id }) => id === existingFile.id)
      ) {
        await deleteVectorStoreFile(vectorStore.id, existingFile.id);
      }
    }
    const fileId = await uploadFileToOpenAI(filePath, purpose);
    if (fileId) {
      const vectorFileId = await addFileToVectorStore(vectorStore.id, fileId);
      files.set(fileId, vectorFileId);
      console.log(`Memory updated with latest ${filename}.`);
    }
  });

  // Handle deleted files
  watcher.on("unlink", async (filePath: string) => {
    !quiet && console.log(`File removed: ${filePath}`);
    const filename = path.basename(filePath);
    const existingFile = await findFileInOpenAIByFilename(filename);
    if (existingFile) {
      await deleteFileFromOpenAI(existingFile.id);
      const existingVectorStoreFiles = await listVectorStoreFiles(
        vectorStore.id
      );
      if (
        existingVectorStoreFiles.data.some(({ id }) => id === existingFile.id)
      ) {
        await deleteVectorStoreFile(vectorStore.id, existingFile.id);
      }
      files.delete(existingFile.id);
    }
  });

  !quiet && console.log(`Watching files matching: ${fullGlobPattern}`);

  return vectorStore.id;
}
