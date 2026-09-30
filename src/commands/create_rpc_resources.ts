import * as fs from "fs";

import ora from "ora";
import { CommandModule } from "yargs";

import { getAndVerifyCredentials } from "../utils/credentials";
import { createResource } from "../utils/resources";
import { logDAU } from "../utils/telemetry";

const inquirer = require("inquirer");

const command = "create-rpc-load-test";
const describe = "Create RPC resources to use for load testing.";
const builder = {};
const handler = async function () {
  const credentials = getAndVerifyCredentials();
  // fire and forget
  void logDAU(credentials);

  console.log(
    "We will be creating RPC resources and storing the ids into a file to use for load testing purposes.\n"
  );

  let { numResources } = (await inquirer.prompt([
    {
      name: "numResources",
      message: "How many resources would you like to create?",
      type: "input",
      validate(input: number) {
        const parsedInput = parseInt(input.toString());
        if (isNaN(parsedInput)) {
          return "Please enter a number.";
        }
        if (parsedInput < 1 || parsedInput > 1000) {
          return "Please enter a number between 1 and 1000.";
        }
        return true;
      },
    },
  ])) as { numResources: number };

  const { fileName } = (await inquirer.prompt([
    {
      name: "fileName",
      message: "What would you like to name the resulting file?",
      type: "input",
      default: "rpc-load-test-resources.json",
      validate(input: string) {
        if (!input.endsWith(".json")) {
          return "Please enter a file name ending in .json";
        }
        return true;
      },
    },
  ])) as { fileName: string };

  // Id of the Retool folder to store the resources in
  const folderId = 3;

  let resourceIds = [];

  const spinner = ora(
    "Creating resources and storing ids into file..."
  ).start();

  const filePath = `./${fileName}`;

  if (fs.existsSync(filePath)) {
    // If it exists, read the existing IDs
    const fileData: string = fs.readFileSync(filePath, "utf-8");
    resourceIds = JSON.parse(fileData);

    numResources = numResources - resourceIds.length;

    console.log(
      `File already exists. Found ${resourceIds.length} existing resources in the file so creating and appending ${numResources} new resources.\n`
    );
  } else {
    console.log(
      `Creating ${numResources} new resources and storing the IDs into file.`
    );
  }

  let i = 0;
  while (i < numResources) {
    if (i % 10 === 0) {
      console.log(`Created ${i} resources so far.`);
    }
    try {
      const resource = await createResource({
        resourceType: "retoolSdk",
        credentials,
        resourceFolderId: folderId,
        resourceOptions: {
          requireExplicitVersion: false,
        },
      });
      resourceIds.push(resource.name);
      i++;
    } catch (error: any) {
      console.log("Failed to create resource with error:", error.message);
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(resourceIds, null, 2));

  spinner.stop();

  console.log(`Successfully created ${numResources} resources!`);
};

const commandModule: CommandModule = {
  command,
  describe,
  builder,
  handler,
};

export default commandModule;
