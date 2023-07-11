const ora = require("ora");

import { getCredentials, fetchDBCredentials } from "../utils/credentials";
import { createTable } from "./db";
import { CommandModule } from "yargs";
import { generateWorkflow } from "../utils/workflows";

const command = "scaffold";
const describe = "Scaffold a retool db, table, and app";
const builder: CommandModule["builder"] = {
  name: {
    alias: "n",
    describe: "Name of table/app to scaffold.",
    type: "string",
    nargs: 1,
  },
  columns: {
    alias: "c",
    describe: "Column names in table to scaffold.",
    type: "array",
  },
};
const handler = async function (argv: any) {
  const spinner = ora("Verifying Retool DB credentials").start();
  let credentials = getCredentials();
  if (!credentials) {
    spinner.stop();
    return;
  }
  if (!credentials.gridId || !credentials.retoolDBUuid) {
    await fetchDBCredentials();
    credentials = getCredentials();
    if (!credentials?.gridId || !credentials?.retoolDBUuid) {
      spinner.stop();
      return;
    }
  }
  spinner.stop();

  await createTable(argv.name, argv.columns, undefined, credentials);
  await generateWorkflow(argv.name);
};

const commandModule: CommandModule = {
  command,
  describe,
  builder,
  handler,
};

export default commandModule;
