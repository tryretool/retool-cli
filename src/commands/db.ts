const fetch = require("node-fetch");
const fs = require("fs");
const inquirer = require("inquirer");
const path = require("path");

import { parseCSV } from "../utils/csv";
import {
  Credentials,
  getCredentials,
  fetchDBCredentials,
} from "../utils/credentials";

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
    nargs: 1,
  },
};
exports.handler = async function (argv: any) {
  const credentials = getCredentials();
  if (!credentials) {
    return;
  }
  let { retoolDBUuid, gridId } = credentials;
  if (!gridId || !retoolDBUuid) {
    const dbCredentials = await fetchDBCredentials();
    if (!dbCredentials) {
      return;
    }
    retoolDBUuid = dbCredentials.retoolDBUuid;
    gridId = dbCredentials.gridId;
  }

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
    var tableName = path.basename(argv.new).slice(0, -4);
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

    // See NewTable.tsx if implementing more complex logic.
    const payload = {
      kind: "CreateTable",
      payload: {
        name: tableName,
        fieldMapping,
        data: rows,
        allowSchemaEditOverride: true,
        primaryKey: {
          kind: headers.includes("id")
            ? "CustomColumn"
            : "IntegerAutoIncrement",
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
      `https://${credentials.domain}/api/grid/${gridId}/action`,
      {
        headers: httpHeaders,
        body: JSON.stringify(payload),
        method: "POST",
      }
    );
    const createTableResponseJson = await createTableResponse.json();
    if (createTableResponseJson.success) {
      console.log("Successfully created a RetoolDB!");
      console.log(
        `See it here: https://${credentials.domain}/resources/data/${retoolDBUuid}/${tableName}?env=production`
      );
    } else {
      console.error(
        "Failed to create a RetoolDB, error: ",
        createTableResponseJson.error
      );
    }
  }
};
