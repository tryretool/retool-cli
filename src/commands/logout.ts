import { deleteCredentials } from "../utils/credentials";

exports.command = "logout";
exports.desc = "Log out of Retool";
exports.builder = {};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
exports.handler = function (argv: any) {
  deleteCredentials();
};
