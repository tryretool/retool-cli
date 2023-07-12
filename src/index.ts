#!/usr/bin/env node

require("yargs/yargs")(process.argv.slice(2))
  .commandDir("commands", {
    visit(commandModule: any) {
      return commandModule.default;
    },
  })
  .demandCommand()
  .showHelpOnFail(false)
  .strict()
  .usage(
    "A CLI tool to interface with Retool. For feedback and issues visit https://github.com/tryretool/retool-cli.\n\nUsage: retool <command>"
  ).argv;
