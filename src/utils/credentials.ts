const fs = require("fs");
const inquirer = require("inquirer");

export const CREDENTIALS_PATH = __dirname + "/.retool-cli-credentials";

export type Credentials = {
  domain: string;
  xsrf: string;
  accessToken: string;
};

export function askForCredentials() {
  inquirer
    .prompt([
      {
        name: "domain",
        message:
          "Welcome to the Retool CLI! What is your Retool domain? (e.g. my-org.retool.com)",
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
      fs.writeFile(CREDENTIALS_PATH, JSON.stringify(answer), (err: any) => {
        if (err) {
          console.error(err);
          return;
        }
        console.log("Credentials saved successfully!");
      });
    });
}

export function getCredentials(): Credentials {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  return credentials;
}
