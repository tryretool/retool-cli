import { CommandModule } from "yargs";
import { deleteCredentials } from "../utils/credentials";

const commandModule: CommandModule = {
  command: "logout",
  describe: "Log out of Retool",
  builder: {},
  handler: () => {
    deleteCredentials();
  },
};

export default commandModule;
