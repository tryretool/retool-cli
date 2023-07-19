const chalk = require("chalk");

import { CommandModule, ArgumentsCamelCase } from "yargs";
import { getCredentials } from "../utils/credentials";

const command = "whoami";
const describe = "Show the current Retool user.";
const builder = {
  verbose: {
    alias: "v",
    describe: "Print additional debugging information.",
  },
};
const handler = function (argv: ArgumentsCamelCase) {
  const credentials = getCredentials();
  if (credentials) {
    if (
      !process.env.DEBUG &&
      !argv.verbose &&
      credentials.firstName &&
      credentials.lastName &&
      credentials.email
    ) {
      console.log(
        `Logged in to ${chalk.bold(credentials.domain)} as ${chalk.bold(
          credentials.firstName
        )} ${chalk.bold(credentials.lastName)} (${credentials.email}) 🙌🏻`
      );
    } else {
      console.log("You are logged in with credentials:");
      console.log(credentials);
    }
  }
};

const commandModule: CommandModule = {
  command,
  describe,
  builder,
  handler,
};

export default commandModule;
