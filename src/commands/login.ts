import { askForCredentials } from "../utils/credentials";

exports.command = "login";
exports.desc = "Log in to Retool";
exports.builder = {};
exports.handler = async function (argv: any) {
  askForCredentials();
};
