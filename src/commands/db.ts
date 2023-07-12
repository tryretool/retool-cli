const fetch = require("node-fetch");
const fs = require("fs");
const inquirer = require("inquirer");
const path = require("path");
const ora = require("ora");

import { parseCSV } from "../utils/csv";
import {
  getCredentials,
  fetchDBCredentials,
  Credentials,
} from "../utils/credentials";
import { logConnectionStringDetails } from "../utils/connectionString";
import { CommandModule } from "yargs";

export type FieldMapping = Array<{
  csvField: string;
  dbField: string | undefined;
  ignored: boolean;
  dbType?: string;
}>;

const command = "db";
const describe = "Interface with Retool DB.";
const builder: CommandModule["builder"] = {
  new: {
    alias: "n",
    describe: `Create a new Retool DB from csv file. Usage:
    retool db -n <path-to-csv>`,
    type: "string",
    nargs: 1,
  },
  create: {
    alias: "c",
    describe: `Create a new Retool DB from column names. Usage:
    retool db -c <col1> <col2> ...`,
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

  // Handle `retool db --new <path-to-csv>`
  if (argv.new) {
    //Verify file exists, is a csv, and is < 15MB.
    if (
      !fs.existsSync(argv.new) ||
      !argv.new.endsWith(".csv") ||
      fs.statSync(argv.new).size > 15000000
    ) {
      console.log("File does not exist or is not a csv or is > 15MB.");
      return;
    }

    //Default to csv filename if no table name is provided.
    let tableName = path.basename(argv.new).slice(0, -4);
    const tableInput: { tableName: string } = await inquirer.prompt([
      {
        name: "tableName",
        message:
          "Table name? If blank, defaults to csv filename. \n  Hint: No spaces, use underscores.",
        type: "input",
      },
    ]);
    if (tableInput.tableName && tableInput.tableName.length > 0) {
      tableName = tableInput.tableName;
    }
    // Remove spaces from table name.
    tableName = tableName.replace(/\s/g, "_");

    const spinner = ora("Parsing CSV").start();
    const parseResult = await parseCSV(argv.new);
    spinner.stop();
    if (!parseResult.success) {
      console.log("Failed to parse CSV, error:");
      console.error(parseResult.error);
      return;
    }

    const { headers, rows } = parseResult;
    await createTable(tableName, headers, rows, credentials);
  }
  // Handle `retool db --create <column-name> <column-name> ...`
  else if (argv.create) {
    let { tableName } = await inquirer.prompt([
      {
        name: "tableName",
        message: "Table name? Hint: No spaces, use underscores.",
        type: "input",
      },
    ]);
    // Remove spaces from table name.
    tableName = tableName.replace(/\s/g, "_");

    await createTable(tableName, argv.create, undefined, credentials);
  }
};

export async function createTable(
  tableName: string,
  headers: string[],
  rows: string[][] | undefined,
  credentials: Credentials
) {
  const spinner = ora("Uploading Table").start();
  const fieldMapping: FieldMapping = headers.map((header) => ({
    csvField: header,
    dbField: header,
    ignored: false,
  }));

  // See NewTable.tsx if implementing more complex logic.
  const payload = {
    kind: "CreateTable",
    payload: {
      name: tableName,
      fieldMapping,
      data: rows,
      allowSchemaEditOverride: true,
      primaryKey: {
        kind: headers.includes("id") ? "CustomColumn" : "IntegerAutoIncrement",
        name: "id",
      },
    },
  };

  const httpHeaders = {
    accept: "application/json",
    "content-type": "application/json",
    "x-xsrf-token": credentials.xsrf,
    cookie: `accessToken=${credentials.accessToken};`,
  };

  const createTableResponse = await fetch(
    `https://${credentials.domain}/api/grid/${credentials.gridId}/action`,
    {
      headers: httpHeaders,
      body: JSON.stringify(payload),
      method: "POST",
    }
  );

  spinner.stop();
  const createTableResponseJson = await createTableResponse.json();
  if (createTableResponseJson.success) {
    console.log("Successfully created a RetoolDB!");
    console.log(
      `View in browswer: https://${credentials.domain}/resources/data/${credentials.retoolDBUuid}/${tableName}?env=production`
    );
    if (credentials.hasConnectionString) {
      await logConnectionStringDetails();
    }
  } else {
    console.error(
      "Failed to create a RetoolDB, error: ",
      createTableResponseJson.error
    );
  }
}

const commandModule: CommandModule = {
  command,
  describe,
  builder,
  handler,
};

export default commandModule;
