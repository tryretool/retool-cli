import { CommandModule } from "yargs";

const command: CommandModule["command"] = "custom-component <command>";
const desc: CommandModule["describe"] =
  "A set of commands for working with custom components.";
const builder: CommandModule["builder"] = function (yargs) {
  return yargs.commandDir("custom_component_cmds");
};

export default {
  command,
  desc,
  builder,
};
