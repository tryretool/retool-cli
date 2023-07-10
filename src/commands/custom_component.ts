import { Argv } from "yargs";

exports.command = "custom-component <command>";
exports.desc = "A set of commands for working with custom components.";
exports.builder = function (yargs: Argv) {
  return yargs.commandDir("custom_component_cmds");
};
