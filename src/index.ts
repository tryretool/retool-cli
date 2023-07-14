#!/usr/bin/env node

const axios = require("axios");

require("yargs/yargs")(process.argv.slice(2))
  .commandDir("commands", {
    visit(commandModule: any) {
      return commandModule.default;
    },
  })
  .demandCommand()
  .strict()
  .usage(
    "A CLI tool to interface with Retool. For feedback and issues visit https://github.com/tryretool/retool-cli.\n\nUsage: retool <command>"
  ).argv;

// Setup axios defaults.
axios.defaults.headers.accept = "application/json";
axios.defaults.headers["content-type"] = "application/json";
