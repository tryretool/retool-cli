import { getCredentials } from "../utils/credentials";

const command = "whoami";
const desc = "Show current Retool user";
const builder = {};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handler = function (argv: any) {
  const credentials = getCredentials();
  if (credentials) {
    console.log("You are logged with credentials:");
    console.log(credentials);
  }
};

export default { command, desc, builder, handler };
