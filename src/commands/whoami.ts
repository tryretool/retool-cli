import { getCredentials } from "../utils/credentials";

exports.command = "whoami";
exports.desc = "Show current Retool user";
exports.builder = {};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
exports.handler = function (argv: any) {
  const credentials = getCredentials();
  if (credentials) {
    console.log("You are logged with credentials:");
    console.log(credentials);
  }
};
