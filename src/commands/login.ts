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

exports.command = "login";
exports.desc = "Log in to Retool";
exports.builder = {};
exports.handler = async function (argv: any) {
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
          name: "Log in by pasting in cookies",
          value: "cookies",
        },
        {
          name: "Log in with a web browser (WIP)",
          value: "browser",
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
  const auth = await fetch(authUrl, {
    headers: {
      ...httpHeaders,
      origin: "https://login.retool.com",
    },
    body: JSON.stringify({ authorizationToken }),
    method: "POST",
  });
  const authJson = await auth.json();
  if (loginJson.error) {
    console.log("Error logging in:");
    console.log(loginJson);
    return;
  }

  // Step 3: Persist the credentials.
  const { redirectUri } = authJson; // Tip: authJson also contains a user object with lots of info.
  const redirectUrl = new URL(redirectUri);
  const setCookie = auth.headers.get("Set-Cookie");

  // Matches everything between accessToken= and ;
  const accessTokenRegex = /accessToken=([^;]+)/;
  const accessTokenMatches = setCookie.match(accessTokenRegex);
  const xsrfTokenRegex = /xsrfToken=([^;]+)/;
  const xsrfTokenMatches = setCookie.match(xsrfTokenRegex);

  if (
    redirectUrl.hostname &&
    accessTokenMatches &&
    xsrfTokenMatches &&
    accessTokenMatches.length > 1 &&
    xsrfTokenMatches.length > 1
  ) {
    await persistCredentials({
      domain: redirectUrl.hostname,
      accessToken: accessTokenMatches[1],
      xsrf: xsrfTokenMatches[1],
    });
  } else {
    console.log(
      "Error parsing credentials from HTTP Response. Please try again."
    );
  }
}

async function loginViaBrowser() {
  const app = express();
  app.use(cookieParser());

  app.get("/auth", function (req, res) {
    const accessToken = req.cookies?.accessToken;
    const xsrfToken = req.cookies?.xsrfToken;

    if (!accessToken || !xsrfToken) {
      console.log("Error: Missing access token or xsrf token. Try again.");
      res.sendFile(path.join(__dirname, "../loginPages/loginFail.html"));
      server_online = false;
      return;
    }

    persistCredentials({
      domain: "retool.com", //TODO: GRAB A REAL DOMAIN SOMEHOW
      accessToken,
      xsrf: xsrfToken,
    });

    res.sendFile(path.join(__dirname, "../loginPages/loginSuccess.html"));
    server_online = false;
  });
  const server = await app.listen(3020);

  open(`https://login.retool.com/auth/login?retoolCliRedirect=true`);
  // open("http://localhost:3000/auth/login?retoolCliRedirect=true");

  // Keep the server online until localhost:3020/auth is hit.
  let server_online = true;
  while (server_online) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  server.close();
}
