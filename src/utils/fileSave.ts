import * as fs from "fs";
import * as path from "path";

import { getRequest } from "./networking";

const axios = require("axios");

// url should be a link to a GitHub folder, e.g. https://api.github.com/repos/tryretool/retool-cli/contents/src/templates
export async function downloadGithubFolder(url: string, directoryPath: string) {
  try {
    // Fetch the directory content using GitHub API
    const response = await getRequest(url);
    const contents = response.data;

    // Create the save directory if it doesn't exist
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true });
    }

    // Iterate through the files and directories and download/save each
    for (const item of contents) {
      const itemName = item.name;
      const itemPath = path.join(directoryPath, itemName);

      if (item.type === "file") {
        const fileResponse = await axios.get(item.download_url, {
          responseType: "arraybuffer",
        });
        fs.writeFileSync(itemPath, fileResponse.data);
      } else if (item.type === "dir") {
        await downloadGithubFolder(`${url}/${itemName}`, itemPath);
      }
    }
  } catch (error: any) {
    console.error("Error downloading files:", error.message);
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
