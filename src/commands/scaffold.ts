import { CommandModule } from "yargs";

import { createAppForTable, deleteApp } from "../utils/apps";
import { Credentials, getAndVerifyFullCredentials } from "../utils/credentials";
import { postRequest } from "../utils/networking";
import {
  collectColumnNames,
  collectTableName,
  createTable,
  deleteTable,
} from "../utils/table";
import { deleteWorkflow, generateCRUDWorkflow } from "../utils/workflows";

const inquirer = require("inquirer");

const command = "scaffold";
const describe = "Scaffold a Retool DB table, CRUD Workflow, and App.";
const builder: CommandModule["builder"] = {
  name: {
    alias: "n",
    describe: `Name of table to scaffold. Usage:
    retool scaffold -n <table_name>`,
    type: "string",
    nargs: 1,
  },
  columns: {
    alias: "c",
    describe: `Column names in DB to scaffold. Usage:
    retool scaffold -c <col1> <col2>`,
    type: "array",
  },
  delete: {
    alias: "d",
    describe: `Delete a table, Workflow and App created via scaffold. Usage:
    retool scaffold -d <db_name>`,
    type: "string",
    nargs: 1,
  },
};
const handler = async function (argv: any) {
  const credentials = await getAndVerifyFullCredentials();

  // Handle `retool scaffold -d <db_name>`
  if (argv.delete) {
    const tableName = argv.delete;
    const workflowName = `${tableName} CRUD Workflow`;

    // Confirm deletion.
    const { confirm } = await inquirer.prompt([
      {
        name: "confirm",
        message: `Are you sure you want to delete ${tableName} table, CRUD workflow and app?`,
        type: "confirm",
      },
    ]);
    if (!confirm) {
      process.exit(0);
    }

    await deleteTable(tableName, credentials, false);
    await deleteWorkflow(workflowName, credentials, false);
    await deleteApp(`${tableName} CRUD App`, credentials, false);
  }

  // Handle `retool scaffold`
  else {
    let tableName = argv.name;
    let colNames = argv.columns;
    if (!tableName || tableName.length == 0) {
      tableName = await collectTableName();
    }
    if (!colNames || colNames.length == 0) {
      colNames = await collectColumnNames();
    }

    await createTable(tableName, colNames, undefined, credentials, false);
    // Fire and forget
    void insertSampleData(tableName, colNames, credentials);
    console.log(
      `Generate mock data with: \`retool db --gendata ${tableName}\``
    );
    console.log("\n");
    await generateCRUDWorkflow(tableName, credentials);
    console.log("\n");

    const searchColumnName = colNames.length > 0 ? colNames[0] : "id";
    await createAppForTable(
      `${tableName} CRUD App`,
      tableName,
      searchColumnName,
      credentials
    );
  }
};

// Insert 3 rows of sample data into the table.
// Sample data is of the form: [[0, "sample", "sample"], [1, "sample", "sample"], [2, "sample", "sample"]]
const insertSampleData = async function (
  tableName: string,
  colNames: Array<string>,
  credentials: Credentials
) {
  let fields = colNames;
  if (!fields.includes("id")) {
    fields = ["id", ...fields];
  }
  const pKeyIndex = fields.indexOf("id");
  const data = [];
  for (let i = 0; i < 3; i++) {
    const row = [];
    for (let j = 0; j < fields.length; j++) {
      row.push(j == pKeyIndex ? `${i}` : "sample");
    }
    data.push(row);
  }

  await postRequest(
    `${credentials.origin}/api/grid/${credentials.gridId}/action`,
    {
      kind: "BulkInsertIntoTable",
      tableName: tableName,
      additions: {
        fields,
        data,
      },
    }
  );
};

const commandModule: CommandModule = {
  command,
  describe,
  builder,
  handler,
};

export default commandModule;
