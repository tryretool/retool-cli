import { input } from "@inquirer/prompts";
import { Entry } from "@napi-rs/keyring";

import { getRequest } from "./networking";
import { isAccessTokenValid, isOriginValid, isXsrfValid } from "./validation";

const axios = require("axios");
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
  telemetryEnabled: boolean; // The next 2 properties control telemetry.
  telemetryLastSent?: number;
};

// A part of credentials that might be passed as the command line arguments.
export type PartialCredentials = Partial<Pick<Credentials, "origin" | "xsrf" | "accessToken">>

// Legacy way of getting credentials.
export async function askForCookies({ origin, xsrf, accessToken }: PartialCredentials) {
  if (!origin) {
    origin = await input({
      message: "What is your Retool origin? (e.g., https://my-org.retool.com).",
    })
  }
  //Check if last character is a slash. If so, remove it.
  if (origin[origin.length - 1] === "/") {
    origin = origin.slice(0, -1);
  }
  if (!isOriginValid(origin)) {
    console.log("Error: Origin is invalid. Remember to include https://.");
    process.exit(1);
  }
  if (!xsrf) {
    xsrf = await input({
      message:
        "What is your XSRF token? (e.g., 26725f72-8129-47f7-835a-cba0e5dbcfe6) \n  Log into Retool, open cookies inspector.\n  In Chrome, hit ⌘+⌥+I (Mac) or Ctrl+Shift+I (Windows, Linux) to open dev tools.\n  Application tab > your-org.retool.com in Cookies menu > double click cookie value and copy it.",
    });
  }
  if (!isXsrfValid(xsrf)) {
    console.log("Error: XSRF token is invalid.");
    process.exit(1);
  }
  if (!accessToken) {
    accessToken = await input({
      message: `What is your access token? It's also found in the cookies inspector.`,
    });
  }
  if (!isAccessTokenValid(accessToken)) {
    console.log("Error: Access token is invalid.");
    process.exit(1);
  }

  persistCredentials({
    origin,
    xsrf,
    accessToken,
    telemetryEnabled: true,
  });
  console.log("Successfully saved credentials.");
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

export async function getAndVerifyCredentialsWithRetoolDB() {
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

export async function getAndVerifyCredentials() {
  const spinner = ora("Verifying Retool credentials").start();
  const credentials = getCredentials();
  if (!credentials) {
    spinner.stop();
    console.log(
      `Error: No credentials found. To log in, run: \`retool login\``
    );
    process.exit(1);
  }
  axios.defaults.headers["x-xsrf-token"] = credentials.xsrf;
  axios.defaults.headers.cookie = `accessToken=${credentials.accessToken};`;
  const verifyLoggedIn = await getRequest(
    `${credentials.origin}/api/user`,
    false
  );
  spinner.stop();
  if (!verifyLoggedIn) {
    console.log("\nError: Credentials are not valid. Please log in again.");
    process.exit(1);
  }
  return credentials;
}
