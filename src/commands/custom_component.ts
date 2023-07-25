import { exec as _exec } from "child_process";
import util from "util";

import ora from "ora";
import { CommandModule } from "yargs";

const exec = util.promisify(_exec);

const command: CommandModule["command"] = "custom-component";
const describe: CommandModule["describe"] = "Interface with custom components.";
const builder: CommandModule["builder"] = {
  clone: {
    alias: "c",
    describe: `Clones https://github.com/tryretool/custom-component-guide to the current directory.`,
    demandOption: true,
  },
};
const handler = async function (argv: any) {
  if (argv.clone) {
    const spinner = ora("Scaffolding a new custom component").start();
    await exec(
      "git clone https://github.com/tryretool/custom-component-guide.git"
    );
    spinner.stop();
    console.log(
      "Scaffolded a new custom component in the custom-component-guide directory."
    );
  }
};

const commandModule: CommandModule = {
  command,
  describe,
  builder,
  handler,
};

export default commandModule;
