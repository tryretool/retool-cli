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
  create: {
    alias: "c",
    describe: `Create a new Retool DB from column names. Usage:
    retool db -c <col1> <col2> ...`,
    type: "array",
  },
  new: {
    alias: "n",
    describe: `Create a new Retool DB from csv file. Usage:
    retool db -n <path-to-csv>`,
    type: "string",
    nargs: 1,
  },
  list: {
    alias: "l",
    describe: "List all Retool DBs.",
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
    const inputName = await inquirer.prompt([
      {
        name: "inputName",
        message: "Table name? If blank, defaults to csv filename.",
        type: "input",
      },
    ]);
    if (inputName.length > 0) {
      tableName = inputName;
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
        message: "Table name?",
        type: "input",
      },
    ]);

    if (tableName.length === 0) {
      console.log("Error: Table name cannot be blank.");
      return;
    }

    // Remove spaces from table name.
    tableName = tableName.replace(/\s/g, "_");

    await createTable(tableName, argv.create, undefined, credentials);
  }
  // Handle `retool db --list`
  else if (argv.list) {
    const spinner = ora("Fetching Retool DBs").start();
    const httpHeaders = {
      accept: "application/json",
      "content-type": "application/json",
      "x-xsrf-token": credentials.xsrf,
      cookie: `accessToken=${credentials.accessToken};`,
    };

    const fetchDBsResponse = await fetch(
      `https://${credentials.domain}/api/grid/retooldb/${credentials.retoolDBUuid}?env=production`,
      {
        headers: httpHeaders,
        method: "GET",
      }
    );

    spinner.stop();
    const fetchDBsResponseJson = await fetchDBsResponse.json();
    if (fetchDBsResponseJson.success) {
      const { tables } = fetchDBsResponseJson.gridInfo;
      if (tables?.length > 0) {
        console.log("Retool DBs:");
        tables.forEach((table: any) => {
          console.log(table.name);
        });
        return;
      }
    }
    console.log("No Retool DBs found.");
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
