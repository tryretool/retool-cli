import untildify from "untildify";
import { CommandModule } from "yargs";

import { getAndVerifyFullCredentials } from "../utils/credentials";
import { parseCSV } from "../utils/csv";
import { generateData, promptForDataType } from "../utils/faker";
import { getRequest, postRequest } from "../utils/networking";
import {
  DBInfoPayload,
  collectColumnNames,
  collectTableName,
  createTable,
  deleteTable,
  fetchAllTables,
  generateDataWithGPT,
  parseDBData,
  verifyTableExists,
} from "../utils/table";

const fs = require("fs");
const path = require("path");

const chalk = require("chalk");
const inquirer = require("inquirer");
const ora = require("ora");

const command = "db";
const describe = "Interface with Retool DB.";
const builder: CommandModule["builder"] = {
  list: {
    alias: "l",
    describe: "List all tables in Retool DB.",
  },
  create: {
    alias: "c",
    describe: `Create a new table.`,
  },
  upload: {
    alias: "u",
    describe: `Upload a new table from a CSV file. Usage:
    retool db -u <path-to-csv>`,
    type: "string",
    nargs: 1,
  },
  delete: {
    alias: "d",
    describe: `Delete a table. Usage:
    retool db -d <table-name>`,
    type: "string",
    nargs: 1,
  },
  gendata: {
    alias: "g",
    describe: `Generate data for a table interactively. Usage:
    retool db -g <table-name>`,
    type: "string",
    nargs: 1,
  },
  gpt: {
    describe: `A modifier for gendata that uses GPT. Usage:
    retool db --gendata <table-name> --gpt`,
  },
};
const handler = async function (argv: any) {
  const credentials = await getAndVerifyFullCredentials();

  // Handle `retool db --upload <path-to-csv>`
  if (argv.upload) {
    const filePath = untildify(argv.upload);
    // Verify file exists, is a csv, and is < 15MB.
    if (
      !fs.existsSync(filePath) ||
      !filePath.endsWith(".csv") ||
      fs.statSync(filePath).size > 18000000
    ) {
      console.log("The file does not exist, is not a CSV, or is > 18MB.");
      return;
    }

    //Default to csv filename if no table name is provided.
    let tableName = path.basename(filePath).slice(0, -4);
    const { inputName } = await inquirer.prompt([
      {
        name: "inputName",
        message: "Table name? If blank, defaults to CSV filename.",
        type: "input",
      },
    ]);
    if (inputName.length > 0) {
      tableName = inputName;
    }
    // Remove spaces from table name.
    tableName = tableName.replace(/\s/g, "_");

    const spinner = ora("Parsing CSV").start();
    const parseResult = await parseCSV(filePath);
    spinner.stop();
    if (!parseResult.success) {
      console.log("Failed to parse CSV, error:");
      console.error(parseResult.error);
      return;
    }

    const { headers, rows } = parseResult;
    await createTable(tableName, headers, rows, credentials, true);
  }

  // Handle `retool db --create`
  else if (argv.create) {
    const tableName = await collectTableName();
    const colNames = await collectColumnNames();
    await createTable(tableName, colNames, undefined, credentials, true);
  }

  // Handle `retool db --list`
  else if (argv.list) {
    const tables = await fetchAllTables(credentials);
    if (tables && tables.length > 0) {
      tables.forEach((table) => {
        console.log(table.name);
      });
    } else {
      console.log("No tables found.");
    }
  }

  // Handle `retool db --delete <table-name>`
  else if (argv.delete) {
    await deleteTable(argv.delete, credentials, true);
  }

  // Handle `retool db --gendata <table-name>`
  else if (argv.gendata) {
    // Verify that the provided db name exists.
    const tableName = argv.gendata;
    await verifyTableExists(tableName, credentials);

    // Fetch Retool DB schema and data.
    const spinner = ora(`Fetching ${tableName} metadata`).start();
    const infoReq = getRequest(
      `${credentials.origin}/api/grid/${credentials.gridId}/table/${tableName}/info`
    );
    const dataReq = postRequest(
      `${credentials.origin}/api/grid/${credentials.gridId}/table/${tableName}/data`,
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

      const gptRes = await generateDataWithGPT(
        retoolDBInfo,
        fields,
        primaryKeyMaxVal,
        credentials,
        true
      );
      //Shouldn't happen, generateDataWithGPT should exit on failure.
      if (!gptRes) {
        process.exit(1);
      }
      generatedData = gptRes;

      spinner.stop();
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
      if (Number.isNaN(parseInt(rowCount))) {
        console.log(`Error: Must provide a number.`);
        return;
      }
      if (rowCount < 0) {
        console.log(`Error: Cannot generate <1 rows.`);
        return;
      }
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

        fields[i].generatedColumnType = await promptForDataType(fields[i].name);
      }

      // Generate mock data.
      generatedData = await generateData(
        fields,
        rowCount,
        retoolDBInfo.tableInfo.primaryKeyColumn,
        primaryKeyMaxVal
      );
    }

    // Insert to Retool DB.
    const bulkInsertRes = await postRequest(
      `${credentials.origin}/api/grid/${credentials.gridId}/action`,
      {
        kind: "BulkInsertIntoTable",
        tableName: tableName,
        additions: generatedData,
      }
    );
    if (bulkInsertRes.data.success) {
      console.log("Successfully inserted data. 🤘🏻");
      console.log(
        `\n${chalk.bold("View in browser:")} ${
          credentials.origin
        }/resources/data/${
          credentials.retoolDBUuid
        }/${tableName}?env=production`
      );
    } else {
      console.log("Error inserting data.");
      console.log(bulkInsertRes.data);
    }
  }

  // No flag specified.
  else {
    console.log(
      "No flag specified. See `retool db --help` for available flags."
    );
  }
};

const commandModule: CommandModule = {
  command,
  describe,
  builder,
  handler,
};

export default commandModule;
