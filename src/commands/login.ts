const fetch = require("node-fetch");
const open = require("open");
const path = require("path");
const cookieParser = require("cookie-parser");
const inquirer = require("inquirer");

import express from "express";
import {
  persistCredentials,
  doCredentialsExist,
  askForCookies,
} from "../utils/credentials";
import { accessTokenFromCookie, xsrfTokenFromCookie } from "../utils/cookies";

const command = "login";
const desc = "Log in to Retool";
const builder = {};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handler = async function (argv: any) {
  // Ask user if they want to overwrite existing credentials.
  if (doCredentialsExist()) {
    const { overwrite } = await inquirer.prompt([
      {
        name: "overwrite",
        message:
          "You're already logged into Retool. Do you want to re-authenticate?",
        type: "confirm",
      },
    ]);
    if (!overwrite) {
      return;
    }
  }

  // Ask user how they want to login.
  const { loginMethod } = await inquirer.prompt([
    {
      name: "loginMethod",
      message: "How would you like to login?",
      type: "list",
      choices: [
        {
          name: "Log in with email/password",
          value: "email",
        },
        {
          name: "Log in via Google SSO in a web browser (WIP)",
          value: "browser",
        },
        {
          name: "Log in by pasting in cookies",
          value: "cookies",
        },
      ],
    },
  ]);
  if (loginMethod === "browser") {
    await loginViaBrowser();
  } else if (loginMethod === "email") {
    await loginViaEmail();
  } else if (loginMethod === "cookies") {
    askForCookies();
  }
};

// Ask the user to input their email and password.
// Fire off a request to Retool's login & auth endpoints.
// Persist the credentials.
async function loginViaEmail() {
  const { email, password } = await inquirer.prompt([
    {
      name: "email",
      message: "What is your email?",
      type: "input",
    },
    {
      name: "password",
      message: "What is your password?",
      type: "password",
    },
  ]);

  const httpHeaders = {
    accept: "application/json",
    "content-type": "application/json",
  };

  // Step 1: Hit /api/login with email and password.
  const login = await fetch(`https://login.retool.com/api/login`, {
    headers: httpHeaders,
    body: JSON.stringify({ email, password }),
    method: "POST",
  });
  const loginJson = await login.json();
  if (loginJson.error) {
    console.log("Error logging in:");
    console.log(loginJson);
    return;
  }
  const { authUrl, authorizationToken } = loginJson;
  if (!authUrl || !authorizationToken) {
    console.log("Error logging in, please try again");
    return;
  }

  // Step 2: Hit /auth/saveAuth with authorizationToken.
  const { redirectUrl, accessToken, xsrf } = await saveAuth(
    authorizationToken,
    authUrl,
    { ...httpHeaders, origin: "https://login.retool.com" }
  ).catch();

  // Step 3: Persist the credentials.
  if (redirectUrl?.hostname && accessToken && xsrf) {
    persistCredentials({
      domain: redirectUrl.hostname,
      accessToken,
      xsrf,
    });
    console.log("Credentials saved/updated successfully!");
  } else {
    console.log(
      "Error parsing credentials from HTTP Response. Please try again."
    );
  }
}

async function loginViaBrowser() {
  // Start a short lived local server to listen for the SSO response.
  const app = express();
  app.use(cookieParser());

  // Step 4: Handle the SSO response.
  // Success scenario format: http://localhost:3020/auth?redirect=https://mycompany.retool.com
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  app.get("/auth", async function (req, res) {
    let domain, url, accessToken, xsrfToken;

    try {
      accessToken = decodeURIComponent(req.query.accessToken as string);
      xsrfToken = decodeURIComponent(req.query.xsrfToken as string);
      url = new URL(decodeURIComponent(req.query.redirect as string));
    } catch (e) {
      console.log(e);
    }

    if (!accessToken || !xsrfToken) {
      console.log(
        "Error: SSO response missing access token or xsrf token. Try again."
      );
      res.sendFile(path.join(__dirname, "../loginPages/loginFail.html"));
      server_online = false;
      return;
    }

    if (!req.query.redirect || !url) {
      res.sendFile(path.join(__dirname, "../loginPages/loginSuccess.html"));
      const { host } = await inquirer.prompt([
        {
          name: "host",
          message:
            "Warning: SSO response did not contain a valid hostname. Please enter hostname of your Retool instance (ie: mycompany.retool.com)",
          type: "input",
        },
      ]);
      domain = host;
    } else {
      domain = url.port ? `${url.hostname}:${url.port}` : url.hostname;
    }

    persistCredentials({
      domain,
      accessToken,
      xsrf: xsrfToken,
    });
    console.log("Credentials saved/updated successfully!");

    if (!res.headersSent) {
      res.sendFile(path.join(__dirname, "../loginPages/loginSuccess.html"));
    }
    server_online = false;
  });
  const server = app.listen(3020);

  // Step 1: Open up the google SSO page in the browser.
  // Step 2: User accepts the SSO request.
  open(`https://login.retool.com/googlelogin?retoolCliRedirect=true`);
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

async function saveAuth(
  authorizationToken: string,
  authUrl: string,
  httpHeaders: any
): Promise<{
  redirectUrl: URL | undefined;
  accessToken: string | undefined;
  xsrf: string | undefined;
}> {
  const auth = await fetch(authUrl, {
    headers: httpHeaders,
    body: JSON.stringify({ authorizationToken }),
    method: "POST",
  });
  const authJson = await auth.json();
  if (authJson.error) {
    console.log("Error logging in:");
    console.log(authJson);
    throw new Error();
  }

  const { redirectUri } = authJson; // Tip: authJson also contains a user object with lots of info.
  const redirectUrl = redirectUri ? new URL(redirectUri) : undefined;
  const accessToken = accessTokenFromCookie(auth.headers.get("Set-Cookie"));
  const xsrf = xsrfTokenFromCookie(auth.headers.get("Set-Cookie"));
  return { redirectUrl, accessToken, xsrf };
}

export default {
  command,
  desc,
  builder,
  handler,
};
