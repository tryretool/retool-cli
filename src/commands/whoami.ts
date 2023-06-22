import { getCredentials } from "../utils/credentials";

exports.command = "whoami";
exports.desc = "Show current Retool user";
exports.builder = {};
exports.handler = async function (argv: any) {
  const credentials = getCredentials();
  if (credentials) {
    console.log("You are logged with credentials:");
    console.log(credentials);
  }
};