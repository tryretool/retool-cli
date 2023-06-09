const fetch = require("node-fetch");
const fs = require("fs");
const inquirer = require("inquirer");
const path = require("path");

import { parseCSV } from "../utils/csv";
import { Credentials, getCredentials } from "../utils/credentials";

export type FieldMapping = Array<{
  csvField: string;
  dbField: string | undefined;
  ignored: boolean;
  dbType?: string;
}>;

exports.command = "db";
exports.desc = "Interface with Retool DB";
exports.builder = {
  new: {
    alias: "n",
    describe: "Create a new Retool database from csv",
  },
};
exports.handler = async function (argv: any) {
  const credentials = getCredentials();
  if (!credentials) {
    return;
  }
  const httpHeaders = {
    accept: "application/json",
    "content-type": "application/json",
    "x-xsrf-token": credentials.xsrf,
    cookie: `accessToken=${credentials.accessToken};`,
  };
  const gridId = await getGridId(httpHeaders, credentials);
  if (!gridId) {
    return;
  }

  // Handle `retool db --new <path-to-csv>`
  if (argv.new) {
    //Verify file exists, is a csv, and is < 3MB.
    if (
      !fs.existsSync(argv.new) ||
      !argv.new.endsWith(".csv") ||
      fs.statSync(argv.new).size > 3145728
    ) {
      console.log("File does not exist or is not a csv or is > 3MB.");
      return;
    }

    //Default to csv filename if no table name is provided.
    var tableName = path.basename(argv.new).slice(0, -4);
    const tableInput: { tableName: string } = await inquirer.prompt([
      {
        name: "tableName",
        message:
          "What would you like to name your new table? If you leave this blank, we'll use the name of the csv file. \n  Hint: No spaces, use underscores.",
        type: "input",
      },
    ]);
    if (tableInput.tableName && tableInput.tableName.length > 0) {
      tableName = tableInput.tableName;
    }
    // Remove spaces from table name.
    tableName = tableName.replace(/\s/g, "_");

    const parseResult = await parseCSV(argv.new);
    if (!parseResult.success) {
      console.error(parseResult.error);
      return;
    }

    const { headers, rows } = parseResult;
    const fieldMapping: FieldMapping = headers.map((header) => ({
      csvField: header,
      dbField: header,
      ignored: false,
    }));

    const payload = {
      kind: "CreateTable",
      payload: {
        name: tableName,
        fieldMapping,
        data: rows,
        allowSchemaEditOverride: true,
        //TODO: Generalize this, right now this assumes a primary key of 'id', look at NewTable.tsx.
        primaryKey: {
          kind: "CustomColumn",
          name: "id",
        },
      },
    };

    const createTableResponse = await fetch(
      `https://${credentials.domain}/api/grid/${gridId}/action`,
      {
        headers: httpHeaders,
        body: JSON.stringify(payload),
        method: "POST",
      }
    );
    const createTableResponseJson = await createTableResponse.json();
    console.log(createTableResponseJson);
  }
};

// Grid ID is needed for all DB operations that exist right now.
// TODO: Cache this somewhere so we don't have to fetch it every time.
async function getGridId(
  httpHeaders: any,
  credentials: Credentials
): Promise<string | undefined> {
  try {
    // 1. Fetch all resources
    const resources = await fetch(
      `https://${credentials.domain}/api/resources`,
      {
        headers: httpHeaders,
        method: "GET",
      }
    );

    // 2. Filter down to Retool DB UUID
    const allResources = await resources.json();
    const retoolDBs = allResources.resources.filter(
      (resource: any) => resource.displayName === "retool_db"
    );
    const retoolDBUuid = retoolDBs[0].name;

    // 3. Fetch Grid Info
    const grid = await fetch(
      `https://${credentials.domain}/api/grid/retooldb/${retoolDBUuid}?env=production`,
      {
        headers: httpHeaders,
        method: "GET",
      }
    );
    const gridJson = await grid.json();
    return gridJson.gridInfo.id;
  } catch (err: any) {
    console.error("Error fetching RetoolDB grid id: ", err);
    return;
  }
}
