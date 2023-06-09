import { deleteCredentials } from "../utils/credentials";

exports.command = "logout";
exports.desc = "Log out of Retool";
exports.builder = {};
exports.handler = async function (argv: any) {
  deleteCredentials();
};
