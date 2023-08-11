import chalk from "chalk";
import ora from "ora";

import { logConnectionStringDetails } from "./connectionString";
import { Credentials } from "./credentials";
import { getRequest, postRequest } from "./networking";

const inquirer = require("inquirer");

type Table = {
  name: string;
};

type FieldMapping = Array<{
  csvField: string;
  dbField: string | undefined;
  ignored: boolean;
  dbType?: string;
}>;

export type DBInfoPayload = {
  success: true;
  tableInfo: RetoolDBTableInfo;
};

// This type is returned from Retool table/info API endpoint.
export type RetoolDBTableInfo = {
  fields: Array<RetoolDBField>;
  primaryKeyColumn: string;
  totalRowCount: number;
};

// A "field" is a single Retool DB column.
export type RetoolDBField = {
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
  generatedColumnType: string | undefined;
};

// Verify that the table exists in Retool DB, otherwise exit.
export async function verifyTableExists(
  tableName: string,
  credentials: Credentials
) {
  const tables = await fetchAllTables(credentials);
  if (!tables?.map((table) => table.name).includes(tableName)) {
    console.log(`No table named ${tableName} found in Retool DB. 😓`);
    console.log(`Use \`retool db --list\` to list all tables.`);
    console.log(`Use \`retool db --create\` to create a new table.`);
    process.exit(1);
  }
}

// Fetches all existing tables from a Retool DB.
export async function fetchAllTables(
  credentials: Credentials
): Promise<Array<Table> | undefined> {
  const spinner = ora("Fetching tables from Retool DB").start();
  const fetchDBsResponse = await getRequest(
    `${credentials.origin}/api/grid/retooldb/${credentials.retoolDBUuid}?env=production`
  );
  spinner.stop();

  if (fetchDBsResponse.data) {
    const { tables } = fetchDBsResponse.data.gridInfo;
    return tables;
  }
}

// Fetches the schema of a table from a Retool DB. Assumes the table exists.
export async function fetchTableInfo(
  tableName: string,
  credentials: Credentials
): Promise<RetoolDBTableInfo | undefined> {
  const spinner = ora(`Fetching ${tableName} metadata`).start();
  const infoResponse = await getRequest(
    `${credentials.origin}/api/grid/${credentials.gridId}/table/${tableName}/info`
  );
  spinner.stop();

  const { tableInfo } = infoResponse.data;
  if (tableInfo) {
    return tableInfo;
  }
}

export async function deleteTable(
  tableName: string,
  credentials: Credentials,
  confirmDeletion: boolean
) {
  // Verify that the provided table name exists.
  await verifyTableExists(tableName, credentials);

  if (confirmDeletion) {
    const { confirm } = await inquirer.prompt([
      {
        name: "confirm",
        message: `Are you sure you want to delete the ${tableName} table?`,
        type: "confirm",
      },
    ]);
    if (!confirm) {
      process.exit(0);
    }
  }

  // Delete the table.
  const spinner = ora(`Deleting ${tableName}`).start();
  await postRequest(
    `${credentials.origin}/api/grid/${credentials.gridId}/action`,
    {
      kind: "DeleteTable",
      payload: {
        table: tableName,
      },
    }
  );
  spinner.stop();

  console.log(`Deleted ${tableName} table. 🗑️`);
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
    `${credentials.origin}/api/grid/${credentials.gridId}/action`,
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
      `${chalk.bold("View in browser:")} ${credentials.origin}/resources/data/${
        credentials.retoolDBUuid
      }/${tableName}?env=production`
    );
    if (credentials.hasConnectionString && printConnectionString) {
      await logConnectionStringDetails();
    }
  }
}

// data param is in format:
// ["col_1","col_2","col_3"]
// ["val_1","val_2","val_3"]
// transform to:
// [["col_1","col_2","col_3"],["val_1","val_2","val_3"]]
export function parseDBData(data: string): string[][] {
  try {
    const rows = data.trim().split("\n");
    rows.forEach(
      (row, index, arr) => (arr[index] = row.slice(1, -1)) // Remove [] brackets.
    );
    const parsedRows: string[][] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i].split(",");
      row.forEach(
        (val, index, arr) => (arr[index] = val.slice(1, -1)) // Remove "".
      );
      parsedRows.push(row);
    }
    return parsedRows;
  } catch (e) {
    console.log("Error parsing table data.");
    console.log(e);
    process.exit(1);
  }
}

export async function generateDataWithGPT(
  retoolDBInfo: DBInfoPayload,
  fields: RetoolDBField[],
  primaryKeyMaxVal: number,
  credentials: Credentials,
  exitOnFailure: boolean
): Promise<
  | {
      fields: string[];
      data: string[][];
    }
  | undefined
> {
  const genDataRes: {
    data: {
      data: string[][];
    };
  } = await postRequest(
    `${credentials.origin}/api/grid/retooldb/generateData`,
    {
      fields: retoolDBInfo.tableInfo.fields.map((field) => {
        return {
          fieldName: field.name,
          fieldType: field.type,
          isPrimaryKey: field.name === retoolDBInfo.tableInfo.primaryKeyColumn,
        };
      }),
    },
    exitOnFailure
  );

  const colNames = fields.map((field) => field.name);
  const generatedRows: string[][] = [];
  if (!genDataRes || colNames.length !== genDataRes?.data?.data[0]?.length) {
    if (exitOnFailure) {
      console.log("Error: GPT did not generate data with correct schema.");
      process.exit(1);
    } else {
      return;
    }
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
  return {
    fields: colNames,
    data: generatedRows,
  };
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
