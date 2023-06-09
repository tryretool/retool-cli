const fetch = require("node-fetch");
const fs = require("fs");
const inquirer = require("inquirer");
const path = require("path");

import { parseCSV } from "../utils/csv";
import { getCredentials } from "../utils/credentials";

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

  if (argv.new) {
    //Verify file exists, is a csv, and is < 3MB
    if (!fs.existsSync(argv.new) || !argv.new.endsWith(".csv")) {
      console.log("File does not exist or is not a csv");
      return;
    }

    //Default to filename if no table name is provided.
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
    // Remove spaces from table name
    tableName = tableName.replace(/\s/g, "_");

    const parseResult = await parseCSV(argv.new);
    if (!parseResult.success) {
      console.log(parseResult.error);
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

    //Fire off network request
    fetch(
      `https://${credentials.domain}/api/grid/grdcebxxsznvs5g0jj4hm90/action`,
      {
        headers: httpHeaders,
        body: JSON.stringify(payload),
        method: "POST",
      }
    )
      // @ts-ignore
      .then((response) => {
        console.log(response);
        return response.json();
      })
      // @ts-ignore
      .then((data) => {
        console.log(data);
      })
      .catch(function (err: any) {
        console.error("Unable to create table - ", err);
      });
  }
};
