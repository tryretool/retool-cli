import chalk from "chalk";
import ora from "ora";
import { CommandModule } from "yargs";

import { getAndVerifyCredentials } from "../utils/credentials";
import {
  downloadGithubFolder,
  saveEnvVariablesToFile,
} from "../utils/fileSave";
import { createPlaygroundQuery } from "../utils/playgroundQuery";
import { ResourceByEnv, getResourceByName } from "../utils/resources";

const inquirer = require("inquirer");

const command = "rpc";
const describe = "Interface with Retool RPC.";
const builder = {};
const handler = async function (argv: any) {
  const credentials = getAndVerifyCredentials();
  const origin = credentials.origin;

  const { resourceName } = (await inquirer.prompt([
    {
      name: "resourceName",
      message: "What is your RPC resource ID?",
      type: "input",
    },
  ])) as { resourceName: string };

  let resourceId: number;

  if (resourceName === "") {
    // TODO: Potentially add logic to create a resource here.
    console.log("Please enter a valid RPC resource ID");
    return;
  } else {
    const resourceByEnv = await getResourceByName(resourceName, credentials);
    validateResourceByEnv(resourceByEnv);

    resourceId = resourceByEnv["production"].id;
  }

  const { rpcAccessToken } = (await inquirer.prompt([
    {
      name: "rpcAccessToken",
      message: `What is your RPC access token? You can add a new one here: ${origin}/settings/api`,
      type: "password",
    },
  ])) as { rpcAccessToken: string };
  if (rpcAccessToken === "") {
    console.log("Please enter a valid RPC access token");
    return;
  }

  const { appType } = (await inquirer.prompt([
    {
      name: "appType",
      message: "Which of the following app templates would you like to use?",
      type: "list",
      choices: [
        {
          name: "Hello World!",
          value: "hello_world",
        },
      ],
    },
  ])) as { appType: string };

  const { destinationPath } = (await inquirer.prompt([
    {
      name: "destinationPath",
      message: "Where would you like to create this app?",
      type: "input",
      default: "./" + "retool_rpc" + "_" + appType,
    },
  ])) as { destinationPath: string };

  const spinner = ora("Creating app").start();

  const queryResult = await createPlaygroundQuery(resourceId, credentials);

  const urlPath =
    "https://api.github.com/repos/tryretool/retool-examples/contents/" +
    appType +
    "/typescript";
  await downloadGithubFolder(urlPath, destinationPath);

  const envVariables = {
    RETOOL_SDK_ID: resourceName,
    RETOOL_SDK_HOST: origin,
    RETOOL_SDK_API_TOKEN: rpcAccessToken,
  };
  saveEnvVariablesToFile(envVariables, destinationPath + "/.env");

  spinner.stop();
  console.log("Done! 🎉\n");

  console.log("To run your app, run the following commands:");
  console.log(`cd ${destinationPath}`);
  console.log("yarn install");
  console.log("yarn example");
  console.log(
    `${chalk.bold("Run example query in browser:")} ${
      credentials.origin
    }/queryLibrary/${queryResult.id}`
  );
};

function validateResourceByEnv(resourceByEnv: ResourceByEnv) {
  if (Object.keys(resourceByEnv).length === 0) {
    console.log("Error finding resource by that id.");
    process.exit(1);
  }
  if (Object.values(resourceByEnv)[0].type !== "retoolSdk") {
    console.log("Resource found is not of expected type");
    process.exit(1);
  }
}

const commandModule: CommandModule = {
  command,
  describe,
  builder,
  handler,
};

export default commandModule;
