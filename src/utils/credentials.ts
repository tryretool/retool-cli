import { Entry } from "@napi-rs/keyring";

import { getRequest } from "./networking";
import { isAccessTokenValid, isOriginValid, isXsrfValid } from "./validation";

const axios = require("axios");
const inquirer = require("inquirer");
const ora = require("ora");

const RETOOL_CLI_SERVICE_NAME = "Retool CLI";
const RETOOL_CLI_ACCOUNT_NAME = "retool-cli-user";

/*
 * Credential management using keyring-rs. This is a cross-platform library
 * which uses the OS's native credential manager.
 * https://github.com/Brooooooklyn/keyring-node
 * https://github.com/hwchen/keyring-rs
 */

export type Credentials = {
  origin: string; // The 3 required properties are fetched during login.
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
        name: "origin",
        message:
          "What is your Retool origin? (e.g., https://my-org.retool.com).",
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
      if (!isOriginValid(answer.origin)) {
        console.log(
          "Error: Origin is invalid. Remember to include https:// and exclude trailing slash."
        );
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

export function persistCredentials(credentials: Credentials) {
  const entry = new Entry(RETOOL_CLI_SERVICE_NAME, RETOOL_CLI_ACCOUNT_NAME);
  entry.setPassword(JSON.stringify(credentials));
}

export function getCredentials(): Credentials | undefined {
  const entry = new Entry(RETOOL_CLI_SERVICE_NAME, RETOOL_CLI_ACCOUNT_NAME);
  const password = entry.getPassword();
  if (password) {
    return JSON.parse(password);
  }
}

export function doCredentialsExist(): boolean {
  const entry = new Entry(RETOOL_CLI_SERVICE_NAME, RETOOL_CLI_ACCOUNT_NAME);
  const password = entry.getPassword();
  if (password) {
    return true;
  }
  return false;
}

export function deleteCredentials() {
  const entry = new Entry(RETOOL_CLI_SERVICE_NAME, RETOOL_CLI_ACCOUNT_NAME);
  entry.deletePassword();
}

// Fetch gridId and retoolDBUuid from Retool. Persist to keychain.
async function fetchDBCredentials() {
  const credentials = getCredentials();
  if (!credentials) {
    return;
  }

  // 1. Fetch all resources
  const resources = await getRequest(`${credentials.origin}/api/resources`);

  // 2. Filter down to Retool DB UUID
  const retoolDBs = resources?.data?.resources?.filter(
    (resource: any) => resource.displayName === "retool_db"
  );
  if (retoolDBs?.length < 1) {
    console.log(
      `\nError: Retool DB not found. Create one at ${credentials.origin}/resources`
    );
    return;
  }

  const retoolDBUuid = retoolDBs[0].name;

  // 3. Fetch Grid Info
  const grid = await getRequest(
    `${credentials.origin}/api/grid/retooldb/${retoolDBUuid}?env=production`
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
