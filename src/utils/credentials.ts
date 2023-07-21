const axios = require("axios");
const ora = require("ora");
const fs = require("fs");
const inquirer = require("inquirer");

import { getRequest } from "./networking";
import { isDomainValid, isAccessTokenValid, isXsrfValid } from "./validation";

export const CREDENTIALS_PATH = __dirname + "/.retool-cli-credentials";

export type Credentials = {
  domain: string; // The 3 required properties are fetched during login.
  xsrf: string;
  accessToken: string;
  gridId?: string; // The next 3 properties are fetched the first time user interacts with RetoolDB.
  retoolDBUuid?: string;
  hasConnectionString?: boolean;
  firstName?: string; // The next 3 properties are sometimes fetched during login.
  lastName?: string;
  email?: string;
};

// Legacy way of getting credentials.
export function askForCookies() {
  inquirer
    .prompt([
      {
        name: "domain",
        message:
          "What is your Retool domain? (e.g., my-org.retool.com). Don't include https:// or http://",
        type: "input",
      },
      {
        name: "xsrf",
        message:
          "What is your XSRF token? (e.g., 26725f72-8129-47f7-835a-cba0e5dbcfe6) \n  Log into Retool, open cookies inspector.\n  In Chrome, hit ⌘+⌥+I (Mac) or Ctrl+Shift+I (Windows, Linux) to open dev tools.\n  Application tab > your-org.retool.com in Cookies menu > double click cookie value and copy it.",
        type: "input",
      },
      {
        name: "accessToken",
        message: `What is your access token? It's also found in the cookies inspector.`,
        type: "input",
      },
    ])
    .then(function (answer: Credentials) {
      if (!isDomainValid(answer.domain)) {
        console.log("Error: Domain is invalid.");
        process.exit(1);
      } else if (!isXsrfValid(answer.xsrf)) {
        console.log("Error: XSRF token is invalid.");
        process.exit(1);
      } else if (!isAccessTokenValid(answer.accessToken)) {
        console.log("Error: Access token is invalid.");
        process.exit(1);
      }
      persistCredentials(answer);
      console.log("Successfully saved credentials.");
    });
}

// Persist credentials to disk at CREDENTIALS_PATH.
export function persistCredentials(credentials: Credentials) {
  try {
    fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials));
  } catch (err) {
    console.error("Error saving credentials to disk, exiting: ", err);
    process.exit(1);
  }
}

// Get credentials from disk.
export function getCredentials(): Credentials | undefined {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
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
    console.log(`No credentials found! To log in, run: retool login`);
    return;
  }

  fs.unlinkSync(CREDENTIALS_PATH);
}

// Fetch gridId and retoolDBUuid from Retool. Persist to disk.
async function fetchDBCredentials() {
  const credentials = getCredentials();
  if (!credentials) {
    return;
  }

  // 1. Fetch all resources
  const resources = await getRequest(
    `https://${credentials.domain}/api/resources`
  );

  // 2. Filter down to Retool DB UUID
  const retoolDBs = resources?.data?.resources?.filter(
    (resource: any) => resource.displayName === "retool_db"
  );
  if (retoolDBs?.length < 1) {
    console.log(
      `\nError: Retool DB not found. Create one at https://${credentials.domain}/resources`
    );
    return;
  }

  const retoolDBUuid = retoolDBs[0].name;

  // 3. Fetch Grid Info
  const grid = await getRequest(
    `https://${credentials.domain}/api/grid/retooldb/${retoolDBUuid}?env=production`
  );
  persistCredentials({
    ...credentials,
    retoolDBUuid,
    gridId: grid?.data?.gridInfo?.id,
    hasConnectionString: grid?.data?.gridInfo?.connectionString?.length > 0,
  });
}

export async function getAndVerifyFullCredentials() {
  const spinner = ora("Verifying Retool DB credentials").start();
  let credentials = getCredentials();
  if (!credentials) {
    spinner.stop();
    console.log(
      `Error: No credentials found. To log in, run: \`retool login\``
    );
    process.exit(1);
  }
  axios.defaults.headers["x-xsrf-token"] = credentials.xsrf;
  axios.defaults.headers.cookie = `accessToken=${credentials.accessToken};`;
  if (!credentials.gridId || !credentials.retoolDBUuid) {
    await fetchDBCredentials();
    credentials = getCredentials();
    if (!credentials?.gridId || !credentials?.retoolDBUuid) {
      spinner.stop();
      console.log(`Error: No Retool DB credentials found.`);
      process.exit(1);
    }
  }
  spinner.stop();
  return credentials;
}
