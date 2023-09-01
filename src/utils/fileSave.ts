import * as fs from "fs";
import * as path from "path";

import * as tar from "tar";

const axios = require("axios");
const inquirer = require("inquirer");

// url should be a tarfile link like https://api.github.com/repos/tryretool/retool-examples/tarball/main
// subfolderPath should be a path to a subfolder within the tarfile, e.g. hello_world/typescript
// destinationPath should be a path to a folder where the contents of the github subfolder will be extracted
export async function downloadGithubSubfolder(
  githubUrl: string,
  subfolderPath: string,
  destinationPath: string
) {
  try {
    const url = `${githubUrl}?path=${subfolderPath}`;
    const response = await axios.get(url, { responseType: "arraybuffer" });

    // Delete the directory if it already exists
    if (fs.existsSync(destinationPath)) {
      const { proceedWithDirectoryCreation } = (await inquirer.prompt([
        {
          name: "proceedWithDirectoryCreation",
          message:
            "It looks like this directory already exists, can we delete it and continue? (Y/N)",
          type: "input",
        },
      ])) as { proceedWithDirectoryCreation: string };
      if (proceedWithDirectoryCreation.toLowerCase() !== "y") {
        console.log("Aborting...");
        process.exit(1);
      }
      await fs.promises.rm(destinationPath, { recursive: true });
    }

    fs.mkdirSync(destinationPath, { recursive: true });

    const tarballPath = path.join(destinationPath, "tarball.tar.gz");
    fs.writeFileSync(tarballPath, response.data);

    await tar.x({
      file: tarballPath,
      cwd: destinationPath,
      strip: subfolderPath.split("/").length + 1, // remove the top-level directories
    });

    fs.unlinkSync(tarballPath);
  } catch (error: any) {
    console.error("Error:", error.message);
  }
}

export function saveEnvVariablesToFile(
  envVariables: Record<string, string>,
  filePath: string
) {
  try {
    const envContent = Object.entries(envVariables)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    fs.writeFileSync(filePath, envContent);
  } catch (error: any) {
    console.error("Error saving environment variables:", error.message);
  }
}
