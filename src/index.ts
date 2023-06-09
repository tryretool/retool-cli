#!/usr/bin/env node

const fs = require("fs");

import { CREDENTIALS_PATH, askForCredentials } from "./utils/credentials";

if (!fs.existsSync(CREDENTIALS_PATH)) {
  console.log(
    `No credentials found at path: ${CREDENTIALS_PATH}, executing login command:`
  );
  askForCredentials();
} else {
  require("yargs/yargs")(process.argv.slice(2))
    .commandDir("commands")
    .demandCommand()
    .help()
    .usage("Usage: retool [command]").argv;
}
