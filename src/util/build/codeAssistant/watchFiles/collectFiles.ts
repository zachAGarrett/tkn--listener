import { promises as fs } from "fs";
import path from "path";
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
async function copyFile(sourcePath: string, targetDir: string, baseDir: string) {
  const flatFileName = flattenFilePath(sourcePath, baseDir);
  const targetPath = path.join(targetDir, flatFileName);

  console.log(`Copying ${sourcePath} to ${targetPath}`);

  try {
    await fs.copyFile(sourcePath, targetPath);
    console.log(`Copied: ${sourcePath} -> ${targetPath}`);
  } catch (error: any) {
    console.error(`Error copying file: ${sourcePath}. Error: ${error.message}`);
  }
}

/**
 * Deletes a single file from the target directory
 */
async function deleteFile(sourcePath: string, targetDir: string, baseDir: string) {
  const flatFileName = flattenFilePath(sourcePath, baseDir);
  const targetPath = path.join(targetDir, flatFileName);

  console.log(`Deleting ${targetPath}`);

  try {
    await fs.unlink(targetPath);
    console.log(`Deleted: ${targetPath}`);
  } catch (error: any) {
    if (error.code === "ENOENT") {
      console.warn(`File not found for deletion: ${targetPath}`);
    } else {
      console.error(`Error deleting file: ${targetPath}. Error: ${error.message}`);
    }
  }
}

/**
 * Watch files and handle add/change/unlink events with glob-watcher
 */
function watchFilesAndCopy(sourceDir: string, targetDir: string, globPattern: string) {
  // Construct the full glob pattern with the source directory
  const fullGlobPattern = path.join(sourceDir, globPattern).replace(/\\/g, '/');

  // Use glob-watcher to watch the provided pattern
  const watcher = watch(fullGlobPattern, { ignoreInitial: true });

  watcher.on('add', (filePath: string) => {
    console.log(`File added: ${filePath}`);
    copyFile(filePath, targetDir, sourceDir);
  });

  watcher.on('change', (filePath: string) => {
    console.log(`File changed: ${filePath}`);
    copyFile(filePath, targetDir, sourceDir);
  });

  watcher.on('unlink', (filePath: string) => {
    console.log(`File removed: ${filePath}`);
    deleteFile(filePath, targetDir, sourceDir);
  });

  console.log(`Watching files matching: ${fullGlobPattern}`);
}

// Get source and target directories and the glob pattern from command line arguments
const [sourceDir, targetDir, globPattern] = process.argv.slice(2);

if (!sourceDir || !targetDir || !globPattern) {
  console.error("Please provide source directory, target directory, and glob pattern.");
  process.exit(1);
}

watchFilesAndCopy(sourceDir, targetDir, globPattern);