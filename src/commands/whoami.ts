import { CommandModule } from "yargs";
import { getCredentials } from "../utils/credentials";

const commandModule: CommandModule = {
  command: "whoami",
  describe: "Show current Retool user",
  builder: {},
  handler: function () {
    const credentials = getCredentials();
    if (credentials) {
      console.log("You are logged with credentials:");
      console.log(credentials);
    }
  },
};

export default commandModule;
