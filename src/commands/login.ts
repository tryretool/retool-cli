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
          name: "Login with a web browser (WIP)",
          value: "browser",
        },
        {
          name: "Login with username/password (WIP)",
          value: "username",
        },
        {
          name: "Login by pasting in cookies",
          value: "cookies",
        },
      ],
    },
  ]);
  if (loginMethod === "browser") {
    await loginViaBrowser();
  } else if (loginMethod === "cookies") {
    askForCookies();
  }
};

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
