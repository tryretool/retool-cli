import { getAndVerifyFullCredentials } from "../utils/credentials";
import { createTable } from "./db";
import { CommandModule } from "yargs";
import { generateApp } from "../utils/apps";
import { generateWorkflow } from "../utils/workflows";
import { collectColumnNames, collectTableName } from "../utils/table";

const command = "scaffold";
const describe = "Scaffold a Retool DB, Workflow, and App.";
const builder: CommandModule["builder"] = {
  name: {
    alias: "n",
    describe: `Name of DB to scaffold. Usage:
    retool scaffold -n <db_name>`,
    type: "string",
    nargs: 1,
  },
  columns: {
    alias: "c",
    describe: `Column names in DB to scaffold. Usage:
    retool scaffold -c <col1> <col2>`,
    type: "array",
  },
};
const handler = async function (argv: any) {
  const credentials = await getAndVerifyFullCredentials();

  let tableName = argv.name;
  let colNames = argv.columns;
  if (!tableName || tableName.length == 0) {
    tableName = await collectTableName();
  }
  if (!colNames || colNames.length == 0) {
    colNames = await collectColumnNames();
  }

  await createTable(tableName, colNames, undefined, credentials, false);
  console.log(`Generate mock data with: \`retool db --gendata ${tableName}\``);
  console.log("\n");
  await generateWorkflow(tableName);
  console.log("\n");
  // await generateApp(tableName);
  console.log("To generate an app:");
  console.log(`1: Go to https://${credentials.domain}`);
  console.log(`2: Click "Create New" > "From Database"`);
  console.log(`3: Resource is "retool_db", select table "${tableName}"`);
};

const commandModule: CommandModule = {
  command,
  describe,
  builder,
  handler,
};

export default commandModule;
