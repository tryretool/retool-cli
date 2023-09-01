import { ArgumentsCamelCase, CommandModule } from "yargs";

import { getCredentials } from "../utils/credentials";
import { logDAU } from "../utils/telemetry";

const chalk = require("chalk");

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
  // fire and forget
  void logDAU(credentials);

  if (credentials) {
    if (
      !process.env.DEBUG &&
      !argv.verbose &&
      credentials.firstName &&
      credentials.lastName &&
      credentials.email
    ) {
      console.log(
        `Logged in to ${chalk.bold(credentials.origin)} as ${chalk.bold(
          credentials.firstName
        )} ${chalk.bold(credentials.lastName)} (${credentials.email}) 🙌🏻`
      );
    } else {
      console.log("You are logged in with credentials:");
      console.log(credentials);
    }
  } else {
    console.log(`No credentials found. To log in, run: \`retool login\``);
  }
};

const commandModule: CommandModule = {
  command,
  describe,
  builder,
  handler,
};

export default commandModule;
