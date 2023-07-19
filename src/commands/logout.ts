import { CommandModule } from "yargs";
import { deleteCredentials } from "../utils/credentials";

const command = "logout";
const describe = "Log out of Retool.";
const builder = {};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handler = function (argv: any) {
  deleteCredentials();
  console.log("Successfully logged out. 👋🏻");
};

const commandModule: CommandModule = {
  command,
  describe,
  builder,
  handler,
};

export default commandModule;
