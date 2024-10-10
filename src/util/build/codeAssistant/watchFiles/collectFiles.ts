import { promises as fs } from "fs";
import path from "path";
import { glob } from "glob";
import watch from "glob-watcher";

/**
 * Replaces path separators with '--' for flat naming in target directory
 */
function flattenFilePath(filePath: string, baseDir: string) {
  const relativePath = path.relative(baseDir, filePath);
  return relativePath.split(path.sep).join("--");
}

/**
 * Copies a single file to the target directory
 */
async function copyFile(
  sourcePath: string,
  targetDir: string,
  baseDir: string
) {
  const flatFileName = flattenFilePath(sourcePath, baseDir);
  const targetPath = path.join(targetDir, flatFileName);

  try {
    await fs.copyFile(sourcePath, targetPath);
  } catch (error: any) {
    console.error(`Error copying file: ${sourcePath}. Error: ${error.message}`);
  }
}

/**
 * Deletes a single file from the target directory
 */
async function deleteFile(
  sourcePath: string,
  targetDir: string,
  baseDir: string
) {
  const flatFileName = flattenFilePath(sourcePath, baseDir);
  const targetPath = path.join(targetDir, flatFileName);

  try {
    await fs.unlink(targetPath);
  } catch (error: any) {
    if (error.code === "ENOENT") {
      console.warn(`File not found for deletion: ${targetPath}`);
    } else {
      console.error(
        `Error deleting file: ${targetPath}. Error: ${error.message}`
      );
    }
  }
}

/**
 * Pre-copy all files from source to target
 */
async function copyAllFiles(
  sourceDir: string,
  targetDir: string,
  globPattern: string
) {
  const fullGlobPattern = path.join(sourceDir, globPattern).replace(/\\/g, "/");

  // Use glob to get all matching files
  const files = glob.sync(fullGlobPattern);

  // Copy each file
  await Promise.all(files.map((file) => copyFile(file, targetDir, sourceDir)));
}

/**
 * Watch files and handle add/change/unlink events with glob-watcher
 */
export async function watchFilesAndCopy(
  sourceDir: string,
  targetDir: string,
  globPattern: string
) {
  // First, copy all existing files
  await copyAllFiles(sourceDir, targetDir, globPattern);

  // Construct the full glob pattern with the source directory
  const fullGlobPattern = path.join(sourceDir, globPattern).replace(/\\/g, "/");

  // Use glob-watcher to watch the provided pattern
  const watcher = watch(fullGlobPattern);

  watcher.on("add", (filePath: string) => {
    copyFile(filePath, targetDir, sourceDir);
  });

  watcher.on("change", (filePath: string) => {
    copyFile(filePath, targetDir, sourceDir);
  });

  watcher.on("unlink", (filePath: string) => {
    deleteFile(filePath, targetDir, sourceDir);
  });
}
