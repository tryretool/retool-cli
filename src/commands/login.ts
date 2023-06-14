const open = require("open");
const path = require("path");
const cookieParser = require("cookie-parser");

import express from "express";
import { persistCredentials } from "../utils/credentials";

exports.command = "login";
exports.desc = "Log in to Retool";
exports.builder = {};
exports.handler = async function (argv: any) {
  //TODO: Ask user if they want to overwrite existing credentials.
  //Copy gh cli.

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

  open(`https://login.retool.com/auth/login?retool_cli_redirect=true`);
  // open("http://localhost:3000/auth/login");

  // Keep the server online until localhost:3020/auth is hit.
  let server_online = true;
  while (server_online) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  server.close();
};
