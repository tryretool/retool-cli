import { CommandModule } from "yargs";

const command: CommandModule["command"] = "custom-component <command>";
const describe: CommandModule["describe"] =
  "A set of commands for working with custom components.";
const builder: CommandModule["builder"] = function (yargs) {
  return yargs.commandDir("custom_component_cmds");
};

const commandModule: CommandModule = {
  command,
  describe,
  builder,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  handler: () => {},
};

export default commandModule;
