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

type GeneratedColumnType =
  | "name"
  | "address"
  | "phoneNumber"
  | "emailAddress"
  | "date"
  | "uuid"
  | "lorem-ipsum";

type BulkInsertIntoTablePayload = {
  kind: "BulkInsertIntoTable";
  tableName: string;
  additions: {
    data: string[][];
    fields: string[];
  };
};

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
  gendata: {
    alias: "g",
    describe: `Generate data for a Retool DB interactively. Usage:
    retool db -g <db-name>`,
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
    const tables = await fetchAllTables(credentials);
    if (tables?.length > 0) {
      console.log("Retool DBs:");
      tables.forEach((table: any) => {
        console.log(table.name);
      });
      return;
    }
    console.log("No Retool DBs found.");
  }
  // Handle `retool db --gendata <db-name>`
  else if (argv.gendata) {
    // Verify that the provided db name exists.
    const tables = await fetchAllTables(credentials);
    if (!tables?.map((table: any) => table.name).includes(argv.gendata)) {
      console.log(`No Retool DB named ${argv.gendata} found.`);
      console.log(`Use \`retool db --list\` to list all Retool DBs.`);
      return;
    }

    //Fetch the db schema.
    const httpHeaders = {
      accept: "application/json",
      "content-type": "application/json",
      "x-xsrf-token": credentials.xsrf,
      cookie: `accessToken=${credentials.accessToken};`,
    };
    const fetchDBResponse = await fetch(
      `https://${credentials.domain}/api/grid/${credentials.gridId}/table/${argv.gendata}/info`,
      {
        headers: httpHeaders,
        method: "GET",
      }
    );
    spinner.stop();
    const fetchDBResponseJson = await fetchDBResponse.json();
    if (!fetchDBResponseJson.success) {
      console.log("Error fetching Retool DB");
      console.log(fetchDBResponseJson);
      return;
    }

    // Ask how many rows to generate.
    // TODO: Enforce this.
    const MAX_BATCH_SIZE = 2500;
    const { rowCount } = await inquirer.prompt([
      {
        name: "rowCount",
        message: "How many rows to generate?",
        type: "input",
      },
    ]);

    // Ask which types of data to generate for each column.
    const { fields } = fetchDBResponseJson.tableInfo;
    for (let i = 0; i < fields.length; i++) {
      if (fields[i].name === "id") continue;

      // TODO: This isn't exhaustive.
      const { generatedType } = await inquirer.prompt([
        {
          name: "generatedType",
          message: `What type of data to generate for ${fields[i].name}?`,
          type: "list",
          choices: ["Name", "Address", "Phone Number", "Email"],
        },
      ]);
      fields[i].generatedType = coerceToGeneratedColumnType(generatedType);
    }

    // Generate mock data.
    const generatedData = generateData(fields, rowCount);
    const payload: BulkInsertIntoTablePayload = {
      kind: "BulkInsertIntoTable",
      tableName: argv.gendata,
      additions: generatedData,
    };

    // Insert to Retool DB.
    const bulkInsertResponse = await fetch(
      `https://${credentials.domain}/api/grid/${credentials.gridId}/action`,
      {
        headers: httpHeaders,
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    const bulkInsertResponseJson = await bulkInsertResponse.json();
    if (bulkInsertResponseJson.success) {
      console.log("Successfully inserted data.");
    } else {
      console.log("Error fetching Retool DB");
      console.log(fetchDBResponseJson);
      return;
    }
  }
};

// TODO: Generalize this. Figure out the id problem.
function generateData(
  fields: any,
  rowCount: number
): {
  data: string[][];
  fields: string[];
} {
  const data = [
    ["4", "asd"],
    ["5", "asd"],
  ];

  return {
    data,
    fields: ["id", "col_1"],
  };
}

// Fetches all existing tables from a Retool DB.
// TODO: Type tables.
async function fetchAllTables(
  credentials: Credentials
): Promise<any | undefined> {
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
    return tables;
  }
}

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

function coerceToGeneratedColumnType(input: string): GeneratedColumnType {
  switch (input) {
    case "Name":
      return "name";
    case "Address":
      return "address";
    case "Phone Number":
      return "phoneNumber";
    case "Email":
      return "emailAddress";
    default:
      return "name";
  }
}

const commandModule: CommandModule = {
  command,
  describe,
  builder,
  handler,
};

export default commandModule;
