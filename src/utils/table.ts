import ora from "ora";
import { Credentials } from "./credentials";
import { getRequest, postRequest } from "./networking";
import chalk from "chalk";
import { logConnectionStringDetails } from "./connectionString";
import { FieldMapping } from "../commands/db";

const inquirer = require("inquirer");

// Verify that the table exists in Retool DB, otherwise exit.
export async function verifyTableExists(
  tableName: string,
  credentials: Credentials
) {
  const tables = await fetchAllTables(credentials);
  if (!tables?.map((table: any) => table.name).includes(tableName)) {
    console.log(`No table named ${tableName} found in Retool DB. 😓`);
    console.log(`Use \`retool db --list\` to list all tables.`);
    console.log(`Use \`retool db --create\` to create a new table.`);
    process.exit(1);
  }
}

// Fetches all existing tables from a Retool DB.
// TODO: Type tables.
export async function fetchAllTables(
  credentials: Credentials
): Promise<any | undefined> {
  const spinner = ora("Fetching tables from Retool DB").start();
  const fetchDBsResponse = await getRequest(
    `https://${credentials.domain}/api/grid/retooldb/${credentials.retoolDBUuid}?env=production`
  );
  spinner.stop();

  if (fetchDBsResponse.data) {
    const { tables } = fetchDBsResponse.data.gridInfo;
    return tables;
  }
}

export async function deleteTable(tableName: string, credentials: Credentials) {
  // Verify that the provided db name exists.
  await verifyTableExists(tableName, credentials);

  // Confirm deletion.
  const { confirm } = await inquirer.prompt([
    {
      name: "confirm",
      message: `Are you sure you want to delete ${tableName}?`,
      type: "confirm",
    },
  ]);
  if (!confirm) {
    process.exit(0);
  }

  // Delete the table.
  const spinner = ora(`Deleting ${tableName}`).start();
  await postRequest(
    `https://${credentials.domain}/api/grid/${credentials.gridId}/action`,
    {
      kind: "DeleteTable",
      payload: {
        table: tableName,
      },
    }
  );
  spinner.stop();

  console.log(`Deleted ${tableName}. 🗑️`);
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
  const createTableResult = await postRequest(
    `https://${credentials.domain}/api/grid/${credentials.gridId}/action`,
    {
      ...payload,
    }
  );
  spinner.stop();

  if (!createTableResult.data.success) {
    console.log("Error creating table in RetoolDB.");
    console.log(createTableResult.data);
    process.exit(1);
  } else {
    console.log("Successfully created a table in RetoolDB. 🎉");
    if (printConnectionString) {
      console.log("");
    }
    console.log(
      `${chalk.bold("View in browser:")} https://${
        credentials.domain
      }/resources/data/${credentials.retoolDBUuid}/${tableName}?env=production`
    );
    if (credentials.hasConnectionString && printConnectionString) {
      await logConnectionStringDetails();
    }
  }
}

export async function collectTableName(): Promise<string> {
  const { tableName } = await inquirer.prompt([
    {
      name: "tableName",
      message: "Table name?",
      type: "input",
    },
  ]);

  if (tableName.length === 0) {
    console.log("Error: Table name cannot be blank.");
    process.exit(1);
  }

  // Remove spaces from table name.
  return tableName.replace(/\s/g, "_");
}

export async function collectColumnNames(): Promise<string[]> {
  const columnNames: string[] = [];
  let columnName = await collectColumnName();
  while (columnName.length > 0) {
    columnNames.push(columnName);
    columnName = await collectColumnName();
  }
  return columnNames;
}

async function collectColumnName(): Promise<string> {
  const { columnName } = await inquirer.prompt([
    {
      name: "columnName",
      message: "Column name? Leave blank to finish.",
      type: "input",
    },
  ]);

  // Remove spaces from column name.
  return columnName.replace(/\s/g, "_");
}
