import { promises as fs } from "fs";
import path from "path";
import { glob } from "glob";

/**
 * Replaces path separators with '--' for flat naming in target directory
 */
function flattenFilePath(filePath: string, baseDir: string) {
  const relativePath = path.relative(baseDir, filePath);
  return relativePath.split(path.sep).join("--");
}

/**
 * Copy files based on a glob pattern
 */
async function copyFilesUsingGlob(
  sourceDir: string,
  targetDir: string,
  globPattern: string
) {
  try {
    // Find files matching the glob pattern in the source directory
    const files = glob.sync(globPattern, { cwd: sourceDir });

    if (files.length === 0) {
      console.log(`No files found matching pattern: ${globPattern}`);
      return;
    } else {
      console.log(
        `Found ${files.length} files matching pattern: ${globPattern}`
      );
    }

    // Iterate over the matched files
    for (const file of files) {
      const sourcePath = path.join(sourceDir, file);
      const flatFileName = flattenFilePath(sourcePath, sourceDir);
      const targetPath = path.join(targetDir, flatFileName);

      console.log(`Copying ${sourcePath} to ${targetPath}`);

      try {
        await fs.copyFile(sourcePath, targetPath);
        console.log(`Copied: ${sourcePath} -> ${targetPath}`);
      } catch (error: any) {
        console.error(
          `Error copying file: ${sourcePath}. Error: ${error.message}`
        );
      }
    }
  } catch (error: any) {
    console.error(`Error during file copy process: ${error.message}`);
  }
}

// Get source and target directories and the glob pattern from command line arguments
const [sourceDir, targetDir, globPattern] = process.argv.slice(2);

if (!sourceDir || !targetDir || !globPattern) {
  console.error(
    "Please provide source directory, target directory, and glob pattern."
  );
  process.exit(1);
}

console.log(
  `Starting to copy files matching pattern ${globPattern} from ${sourceDir} to ${targetDir}...`
);

copyFilesUsingGlob(sourceDir, targetDir, globPattern)
  .then(() => console.log("File copy process completed."))
  .catch((error) =>
    console.error(`Error during file copy process: ${error.message}`)
  );
