import { confirm, input, select } from "@inquirer/prompts";
import express from "express";
import { ArgumentsCamelCase, CommandBuilder, CommandModule, InferredOptionTypes } from "yargs";

import { accessTokenFromCookies, xsrfTokenFromCookies } from "../utils/cookies";
import {
  askForCookies,
  doCredentialsExist,
  getCredentials,
  persistCredentials,
} from "../utils/credentials";
import { getRequest, postRequest } from "../utils/networking";
import { logDAU } from "../utils/telemetry";

const path = require("path");

const axios = require("axios");
const chalk = require("chalk");
const open = require("open");

// A helper function to create CommandBuilder without losing the type
// information about defined keys.
function createBuilder<T extends CommandBuilder>(input: T) { return input }

const command = "login";
const describe = "Log in to Retool.";
const builder = createBuilder({
  "access-token": {
    describe: "Specify access token to use for Cookie login",
    type: "string",
  },
  email: {
    describe: "Specify user email for email / localhost login",
    type: "string",
  },
  force: {
    describe: "Re-authenticate even when already logged in",
    type: "boolean",
  },
  "login-method": {
    describe: "Specify login method",
    choices: [
      "browser",
      "email",
      "cookies",
      "localhost",
    ],
    type: "string",
  },
  origin: {
    describe: "Specify the login origin host",
    type: "string",
  },
  password: {
    describe: "Specify password for email / localhost login",
    type: "string",
  },
  "xsrf-token": {
    describe: "Specify XSRF token to use for Cookie login",
    type: "string",
  },
});

type LoginOptionType = InferredOptionTypes<typeof builder>
const handler = async function (argv: ArgumentsCamelCase<LoginOptionType>) {
  // Ask user if they want to overwrite existing credentials.
  if (doCredentialsExist() && !argv.force) {
    const overwrite = await confirm({
      message: "You're already logged in. Do you want to re-authenticate?",
    })
    if (!overwrite) {
      return;
    }
  }

  // Ask user how they want to login.
  let loginMethod = argv.loginMethod
  if (!loginMethod) {
    loginMethod = await select({
      message: "How would you like to login?",
      choices: [
        {
          name: "Log in using Google SSO in a web browser",
          value: "browser",
        },
        {
          name: "Log in with email and password",
          value: "email",
        },
        {
          name: "Log in by pasting in cookies",
          value: "cookies",
        },
        {
          name: "Log in to localhost:3000",
          value: "localhost",
        },
      ],
    });
  }
  if (loginMethod === "browser") {
    await loginViaBrowser();
  } else if (loginMethod === "email") {
    await loginViaEmail(false, argv.email, argv.password);
  } else if (loginMethod === "cookies") {
    await askForCookies({
      origin: argv.origin,
      xsrf: argv.xsrfToken,
      accessToken: argv.accessToken,
    });
  } else if (loginMethod === "localhost") {
    await loginViaEmail(true, argv.email, argv.password);
  }

  await logDAU();
};

// Ask the user to input their email and password.
// Fire off a request to Retool's login & auth endpoints.
// Persist the credentials.
async function loginViaEmail(localhost = false, email?: string, password?: string) {
  if (!email) {
    email = await input({
      message: "What is your email?",
    })
  }
  if (!password) {
    password = await input({
      message: "What is your password?",
    });
  }

  const loginOrigin = localhost
    ? "http://localhost:3000"
    : "https://login.retool.com";

  // Step 1: Hit /api/login with email and password.
  const login = await postRequest(`${loginOrigin}/api/login`, {
    email,
    password,
  });
  const { authUrl, authorizationToken } = login.data;
  if (!authUrl || !authorizationToken) {
    console.log("Error logging in, please try again");
    return;
  }

  // Step 2: Hit /auth/saveAuth with authorizationToken.
  const authResponse = await postRequest(
    localhost ? `${loginOrigin}${authUrl}` : authUrl,
    {
      authorizationToken,
    },
    true,
    {
      origin: loginOrigin,
    }
  );
  const { redirectUri } = authResponse.data;
  const redirectUrl = localhost
    ? new URL(loginOrigin)
    : redirectUri
    ? new URL(redirectUri)
    : undefined;
  const accessToken = accessTokenFromCookies(
    authResponse.headers["set-cookie"]
  );
  const xsrfToken = xsrfTokenFromCookies(authResponse.headers["set-cookie"]);

  // Step 3: Persist the credentials.
  if (redirectUrl?.origin && accessToken && xsrfToken) {
    persistCredentials({
      origin: redirectUrl.origin,
      accessToken,
      xsrf: xsrfToken,
      firstName: authResponse.data.user?.firstName,
      lastName: authResponse.data.user?.lastName,
      email: authResponse.data.user?.email,
      telemetryEnabled: true,
    });
    logSuccess();
  } else {
    console.log(
      "Error parsing credentials from HTTP Response. Please try again."
    );
  }
}

async function loginViaBrowser() {
  // Start a short lived local server to listen for the SSO response.
  const app = express();

  // Step 4: Handle the SSO response.
  // Success scenario format: http://localhost:3020/auth?redirect=https://mycompany.retool.com
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.get("/auth", async function (req, res) {
    let url, accessToken, xsrfToken;

    try {
      accessToken = decodeURIComponent(req.query.accessToken as string);
      xsrfToken = decodeURIComponent(req.query.xsrfToken as string);
      url = new URL(decodeURIComponent(req.query.redirect as string));
    } catch (e) {
      console.log(e);
    }

    if (!accessToken || !xsrfToken || !url) {
      console.log("Error: SSO response missing information. Try again.");
      res.sendFile(path.join(__dirname, "../loginPages/loginFail.html"));
      server_online = false;
      return;
    }

    axios.defaults.headers["x-xsrf-token"] = xsrfToken;
    axios.defaults.headers.cookie = `accessToken=${accessToken};`;
    const userRes = await getRequest(`https://${url.hostname}/api/user`);

    persistCredentials({
      origin: url.origin,
      accessToken,
      xsrf: xsrfToken,
      firstName: userRes.data.user?.firstName,
      lastName: userRes.data.user?.lastName,
      email: userRes.data.user?.email,
      telemetryEnabled: true,
    });
    logSuccess();
    res.sendFile(path.join(__dirname, "../loginPages/loginSuccess.html"));
    server_online = false;
  });
  const server = app.listen(3020);

  // Step 1: Open up the google SSO page in the browser.
  // Step 2: User accepts the SSO request.
  open(
    `https://login.retool.com/googlelogin?retoolCliRedirect=true&origin=login`
  );
  // For local testing:
  // open("http://localhost:3000/googlelogin?retoolCliRedirect=true");
  // open("https://login.retool-qa.com/googlelogin?retoolCliRedirect=true");
  // open("https://admin.retool.dev/googlelogin?retoolCliRedirect=true");

  // Step 3: Keep the server online until localhost:3020/auth is hit.
  let server_online = true;
  while (server_online) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  server.close();
}

export function logSuccess() {
  const credentials = getCredentials();
  if (credentials?.firstName && credentials.lastName && credentials.email) {
    console.log(
      `Logged in as ${chalk.bold(credentials.firstName)} ${chalk.bold(
        credentials.lastName
      )} (${credentials.email}) ✅`
    );
  } else {
    console.log("Successfully saved credentials.");
  }
}

const commandModule: CommandModule<any, LoginOptionType> = {
  command,
  describe,
  builder,
  handler,
};

export default commandModule;
