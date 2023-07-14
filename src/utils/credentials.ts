const fs = require("fs");
const inquirer = require("inquirer");

import { getRequest } from "./networking";

export const CREDENTIALS_PATH = __dirname + "/.retool-cli-credentials";

// The required properties are fetched during login.
// The optional properties are fetched the first time the user runs `retool db`.
export type Credentials = {
  domain: string;
  xsrf: string;
  accessToken: string;
  gridId?: string;
  retoolDBUuid?: string;
  hasConnectionString?: boolean;
};

// Legacy way of getting credentials.
export function askForCookies() {
  inquirer
    .prompt([
      {
        name: "domain",
        message:
          "What is your Retool domain? (e.g. my-org.retool.com). Don't include https:// or http://",
        type: "input",
      },
      {
        name: "xsrf",
        message:
          "Great, now what is your XSRF token? (e.g. 26725f72-8129-47f7-835a-bca0e5dbcfe6) \n  You can find this by logging into Retool, and opening up the cookies inspector in your browser's dev tools.\n  In Chrome, hit ⌘+⌥+I (Mac) or Ctrl+Shift+I (Windows, Linux) to open the dev tools.\n  Application tab > your-org.retool.com from the Cookies section on the left > double click the cookie value and copy it.",
        type: "input",
      },
      {
        name: "accessToken",
        message: `Last thing! What is your access token? It's a very long string, also found in the cookies inspector.`,
        type: "input",
      },
    ])
    .then(function (answer: Credentials) {
      persistCredentials(answer);
      console.log("Credentials saved/updated successfully!");
    });
}

// Persist credentials to disk at CREDENTIALS_PATH.
export function persistCredentials(credentials: Credentials) {
  try {
    fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials));
  } catch (err) {
    console.error("Error saving credentials to disk: ", err);
  }
}

// Get credentials from disk.
export function getCredentials(): Credentials | undefined {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.log(`No credentials found! To login, run: retool login`);
    return;
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
}

// Check if credentials exist on disk.
export function doCredentialsExist(): boolean {
  return fs.existsSync(CREDENTIALS_PATH);
}

// Delete credentials from disk if they exist.
export function deleteCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.log(
      `No credentials found, nothing to delete! To login, run: retool login`
    );
    return;
  }

  fs.unlinkSync(CREDENTIALS_PATH, (err: any) => {
    if (err) {
      console.error("Error deleting credentials from disk: ", err);
      return;
    }

    console.log("Credentials successfully deleted.");
  });
}

// Fetch gridId and retoolDBUuid from Retool. Persist to disk.
export async function fetchDBCredentials() {
  const credentials = getCredentials();
  if (!credentials) {
    return;
  }

  // 1. Fetch all resources
  const resources = await getRequest(
    `https://${credentials.domain}/api/resources`
  );

  // 2. Filter down to Retool DB UUID
  const retoolDBs = resources.data.resources.filter(
    (resource: any) => resource.displayName === "retool_db"
  );
  const retoolDBUuid = retoolDBs[0].name;

  // 3. Fetch Grid Info
  const grid = await getRequest(
    `https://${credentials.domain}/api/grid/retooldb/${retoolDBUuid}?env=production`
  );
  persistCredentials({
    ...credentials,
    retoolDBUuid,
    gridId: grid.data.gridInfo.id,
    hasConnectionString: grid.data.gridInfo?.connectionString?.length > 0,
  });
}
