import { getCredentials } from "../utils/credentials";

export const command = "whoami";
export const desc = "Show current Retool user";
export const builder = {};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const handler = function (argv: any) {
  const credentials = getCredentials();
  if (credentials) {
    console.log("You are logged with credentials:");
    console.log(credentials);
  }
};
