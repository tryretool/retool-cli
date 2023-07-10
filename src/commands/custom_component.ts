import { CommandModule } from "yargs";

const commandModule: CommandModule = {
  command: "custom-component <command>",
  describe: "A set of commands for working with custom components.",
  builder: (yargs) => {
    return yargs.commandDir("custom_component_cmds");
  },
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  handler: () => {},
};

export default commandModule;
