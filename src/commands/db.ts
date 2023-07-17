const axios = require("axios");
const { faker } = require("@faker-js/faker");
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
import { getRequest, postRequest } from "../utils/networking";
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
  | "phone"
  | "email"
  | "date"
  | "lorem"
  | "randomNumber";

type DBInfoPayload = {
  success: true;
  tableInfo: RetoolDBTableInfo;
};

// This type is returned from Retool table/info API endpoint.
type RetoolDBTableInfo = {
  fields: Array<RetoolDBField>;
  primaryKeyColumn: string;
  totalRowCount: number;
};

// A "field" is a single Retool DB column.
type RetoolDBField = {
  name: string;
  type: any; //GridFieldType
  columnDefault:
    | {
        kind: "NoDefault";
      }
    | {
        kind: "LiteralDefault";
        value: string;
      }
    | {
        kind: "ExpressionDefault";
        value: string;
      };
  generatedColumnType: GeneratedColumnType | undefined;
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
  gpt: {
    describe: `A modifier for the gendata command to use GPT to generate data. Usage:
    retool db --gendata <db-name> --gpt`,
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
  axios.defaults.headers["x-xsrf-token"] = credentials.xsrf;
  axios.defaults.headers.cookie = `accessToken=${credentials.accessToken};`;
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
    await createTable(tableName, headers, rows, credentials, true);
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

    await createTable(tableName, argv.create, undefined, credentials, true);
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

    const spinner = ora(`Fetching ${argv.gendata} metadata`).start();

    // Fetch Retool DB schema and data.
    const infoReq = getRequest(
      `https://${credentials.domain}/api/grid/${credentials.gridId}/table/${argv.gendata}/info`
    );
    const dataReq = postRequest(
      `https://${credentials.domain}/api/grid/${credentials.gridId}/table/${argv.gendata}/data`,
      {
        filters: [],
        sorting: [],
      }
    );
    const [infoRes, dataRes] = await Promise.all([infoReq, dataReq]);
    spinner.stop();
    const retoolDBInfo: DBInfoPayload = infoRes.data;
    const { fields } = retoolDBInfo.tableInfo;
    const retoolDBData: string = dataRes.data;

    // Find the max primary key value.
    // 1. Parse the table data.
    const parsedDBData = parseDBData(retoolDBData);
    // 2. Find the index of the primary key column.
    const primaryKeyColIndex = parsedDBData[0].indexOf(
      retoolDBInfo.tableInfo.primaryKeyColumn
    );
    // 3. Find the max value of the primary key column.
    const primaryKeyMaxVal = Math.max(
      ...parsedDBData
        .slice(1)
        .map((row) => row[primaryKeyColIndex])
        .map((id) => parseInt(id)),
      0
    );

    let generatedData: { fields: string[]; data: string[][] };

    // Generate data using GPT.
    if (argv.gpt) {
      spinner.start("Generating data using GPT");
      const genDataRes: {
        data: {
          data: string[][];
        };
      } = await postRequest(
        `https://${credentials.domain}/api/grid/retooldb/generateData`,
        {
          fields: retoolDBInfo.tableInfo.fields.map((field) => {
            return {
              fieldName: field.name,
              fieldType: field.type,
              isPrimaryKey:
                field.name === retoolDBInfo.tableInfo.primaryKeyColumn,
            };
          }),
        }
      );
      spinner.stop();
      const colNames = fields.map((field) => field.name);
      const generatedRows: string[][] = [];
      if (colNames.length !== genDataRes.data.data[0].length) {
        console.log(
          "Error: GPT did not generate the correct number of columns"
        );
        process.exit(1);
      }

      // GPT does not generate primary keys correctly.
      // Generate them manually by adding the max primary key value to row #.
      for (let i = 0; i < genDataRes.data.data.length; i++) {
        const row = genDataRes.data.data[i];
        for (let j = 0; j < row.length; j++) {
          if (colNames[j] === retoolDBInfo.tableInfo.primaryKeyColumn) {
            row[j] = (primaryKeyMaxVal + i + 1).toString();
          }
        }
        generatedRows.push(row);
      }
      generatedData = {
        fields: colNames,
        data: generatedRows,
      };
    }
    // Generate data using faker.
    else {
      // Ask how many rows to generate.
      const MAX_BATCH_SIZE = 2500;
      const { rowCount } = await inquirer.prompt([
        {
          name: "rowCount",
          message: "How many rows to generate?",
          type: "input",
        },
      ]);
      if (rowCount > MAX_BATCH_SIZE) {
        console.log(
          `Error: Cannot generate more than ${MAX_BATCH_SIZE} rows at a time.`
        );
        return;
      }

      // Ask what type of data to generate for each column.
      for (let i = 0; i < fields.length; i++) {
        if (fields[i].name === retoolDBInfo.tableInfo.primaryKeyColumn)
          continue;

        const { generatedType } = await inquirer.prompt([
          {
            name: "generatedType",
            message: `What type of data to generate for ${fields[i].name}?`,
            type: "list",
            choices: [
              "Name",
              "Address",
              "Phone Number",
              "Email",
              "Date",
              "Lorem Ipsum",
              "Random Number",
            ],
          },
        ]);
        fields[i].generatedColumnType =
          coerceToGeneratedColumnType(generatedType);
      }

      // Generate mock data.
      generatedData = generateData(
        fields,
        rowCount,
        retoolDBInfo.tableInfo.primaryKeyColumn,
        primaryKeyMaxVal
      );
      console.log(generatedData);
    }

    // Insert to Retool DB.
    await postRequest(
      `https://${credentials.domain}/api/grid/${credentials.gridId}/action`,
      {
        kind: "BulkInsertIntoTable",
        tableName: argv.gendata,
        additions: generatedData,
      }
    );
    console.log("Successfully inserted data.");
  }
};

// data param is in format:
// ["col_1","col_2","col_3"]
// ["val_1","val_2","val_3"]
// transform to:
// [["col_1","col_2","col_3"],["val_1","val_2","val_3"]]
function parseDBData(data: string): string[][] {
  try {
    let rows = data.trim().split("\n");
    // Remove all quotes and [] brackets.
    rows = rows.map((row: string) =>
      row.replace(/"/g, "").replace(/\[/g, "").replace(/\]/g, "")
    );
    const parsedRows: string[][] = [];
    for (let i = 0; i < rows.length; i++) {
      parsedRows.push(rows[i].split(","));
    }
    return parsedRows;
  } catch (e) {
    console.log("Error parsing DB data.");
    console.log(e);
    process.exit(1);
  }
}

function generateData(
  fields: Array<RetoolDBField>,
  rowCount: number,
  primaryKeyColumnName: string,
  primaryKeyMaxVal: number
): {
  data: string[][]; // rows
  fields: string[]; // column names
} {
  const column_names = fields.map((field) => field.name);
  const rows: string[][] = [];
  // Init rows
  for (let j = 0; j < rowCount; j++) {
    rows.push([]);
  }

  for (let i = 0; i < fields.length; i++) {
    for (let j = 0; j < rowCount; j++) {
      // Handle primary key column.
      if (fields[i].name === primaryKeyColumnName) {
        rows[j].push((primaryKeyMaxVal + j + 1).toString());
      } else {
        rows[j].push(generateDataForColumn(fields[i]));
      }
    }
  }

  return {
    data: rows,
    fields: column_names,
  };
}

function generateDataForColumn(field: RetoolDBField): string {
  switch (field.generatedColumnType) {
    case "name":
      return faker.person.fullName();
    case "address":
      return faker.location.streetAddress();
    case "phone":
      return faker.phone.number();
    case "email":
      return faker.internet.email();
    case "date":
      return faker.date.recent();
    case "lorem":
      return faker.lorem.sentence(5);
    case "randomNumber":
      return faker.number.int(1000);
    default:
      return "";
  }
}

// Fetches all existing tables from a Retool DB.
// TODO: Type tables.
async function fetchAllTables(
  credentials: Credentials
): Promise<any | undefined> {
  const spinner = ora("Fetching Retool DBs").start();
  const fetchDBsResponse = await getRequest(
    `https://${credentials.domain}/api/grid/retooldb/${credentials.retoolDBUuid}?env=production`
  );
  spinner.stop();

  if (fetchDBsResponse.data) {
    const { tables } = fetchDBsResponse.data.gridInfo;
    return tables;
  }
}

export async function createTable(
  tableName: string,
  headers: string[],
  rows: string[][] | undefined,
  credentials: Credentials,
  printConnectionString: boolean
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

  await postRequest(
    `https://${credentials.domain}/api/grid/${credentials.gridId}/action`,
    {
      ...payload,
    }
  );

  spinner.stop();
  console.log("Successfully created a RetoolDB!");
  console.log(
    `View in browswer: https://${credentials.domain}/resources/data/${credentials.retoolDBUuid}/${tableName}?env=production`
  );
  if (credentials.hasConnectionString && printConnectionString) {
    await logConnectionStringDetails();
  }
}

function coerceToGeneratedColumnType(input: string): GeneratedColumnType {
  switch (input) {
    case "Name":
      return "name";
    case "Address":
      return "address";
    case "Phone Number":
      return "phone";
    case "Email":
      return "email";
    case "Date":
      return "date";
    case "Lorem Ipsum":
      return "lorem";
    case "Random Number":
      return "randomNumber";
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
