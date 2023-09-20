import { CommandModule } from "yargs";

import {
  getAndVerifyCredentials,
  persistCredentials,
} from "../utils/credentials";

const command = "telemetry";
const describe = "Configure CLI telemetry.";
const builder = {
  disable: {
    alias: "d",
    describe: `Disable telemetry.`,
  },
  enable: {
    alias: "e",
    describe: `Enable telemetry.`,
  },
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handler = async function (argv: any) {
  const credentials = await getAndVerifyCredentials();

  if (argv.disable) {
    credentials.telemetryEnabled = false;
    persistCredentials(credentials);
    console.log("Successfully disabled telemetry. 📉");
  } else if (argv.enable) {
    credentials.telemetryEnabled = true;
    persistCredentials(credentials);
    console.log("Successfully enabled telemetry. 📈");
  } else {
    console.log(
      "No flag specified. See `retool telemetry --help` for available flags."
    );
  }
};

const commandModule: CommandModule = {
  command,
  describe,
  builder,
  handler,
};

export default commandModule;
