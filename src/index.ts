#!/usr/bin/env node

const axios = require("axios");

require("yargs/yargs")(process.argv.slice(2))
  .commandDir("commands", {
    visit(commandModule: any) {
      return commandModule.default;
    },
  })
  .parserConfiguration({ "boolean-negation": false })
  .demandCommand()
  .strict()
  .usage(
    "Work seamlessly with Retool from the command line. For feedback and issues visit https://github.com/tryretool/retool-cli.\n\nUsage: retool <command> [flags]"
  ).argv;

// Setup axios defaults.
axios.defaults.headers.accept = "application/json";
axios.defaults.headers["content-type"] = "application/json";
