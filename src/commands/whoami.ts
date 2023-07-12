import { CommandModule, ArgumentsCamelCase } from "yargs";
import { getCredentials } from "../utils/credentials";

const command = "whoami";
const describe = "Show current Retool user.";
const builder = {};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handler = function (argv: ArgumentsCamelCase) {
  const credentials = getCredentials();
  if (credentials) {
    console.log("You are logged with credentials:");
    console.log(credentials);
  }
};

const commandModule: CommandModule = {
  command,
  describe,
  builder,
  handler,
};

export default commandModule;
