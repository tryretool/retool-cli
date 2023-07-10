#!/usr/bin/env node

require("yargs/yargs")(process.argv.slice(2))
  .commandDir("commands", {
    visit(commandModule: any) {
      return commandModule.default;
    },
  })
  .demandCommand()
  .help()
  .usage("Usage: retool [command]").argv;
