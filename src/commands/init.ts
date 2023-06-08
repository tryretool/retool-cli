import { askForCredentials } from "../utils/credentials";

exports.command = "init";
exports.desc = "Initialize Retool CLI";
exports.builder = {};
exports.handler = async function (argv: any) {
  askForCredentials();
};
