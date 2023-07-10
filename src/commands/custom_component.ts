import { Argv } from "yargs";

exports.command = "custom-component <command>";
exports.desc = "A set of commands to set up a custom component";
exports.builder = function (yargs: Argv) {
  return yargs.commandDir("custom_component_cmds");
};
exports.handler = function (argv: Argv) {};
