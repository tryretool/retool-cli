import { Argv } from "yargs";

export const command = "custom-component <command>";
export const desc = "A set of commands for working with custom components.";
export const builder = function (yargs: Argv) {
  return yargs.commandDir("custom_component_cmds");
};
