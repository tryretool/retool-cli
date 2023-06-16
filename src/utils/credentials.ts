const fs = require("fs");
const inquirer = require("inquirer");

export const CREDENTIALS_PATH = __dirname + "/.retool-cli-credentials";

export type Credentials = {
  domain: string;
  xsrf: string;
  accessToken: string;
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
    });
}

// Persist credentials to disk at CREDENTIALS_PATH.
export async function persistCredentials(credentials: Credentials) {
  fs.writeFile(CREDENTIALS_PATH, JSON.stringify(credentials), (err: any) => {
    if (err) {
      console.error("Error saving credentials to disk: ", err);
      return;
    }
    console.log("Credentials saved successfully!");
  });
}

// Get credentials from disk.
export function getCredentials(): Credentials | undefined {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.log(`No credentials found! To login, run: retool login`);
    return;
  }
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  return credentials;
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

  fs.unlink(CREDENTIALS_PATH, (err: any) => {
    if (err) {
      console.error("Error deleting credentials from disk: ", err);
      return;
    }

    console.log("Credentials successfully deleted.");
  });
}
