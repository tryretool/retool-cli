import { CommandModule, ArgumentsCamelCase } from "yargs";
import { getCredentials } from "../utils/credentials";

const command = "whoami";
const describe = "Show the current Retool user.";
const builder = {};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handler = function (argv: ArgumentsCamelCase) {
  const credentials = getCredentials();
  if (credentials) {
    console.log("You are logged in with these credentials:");
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
