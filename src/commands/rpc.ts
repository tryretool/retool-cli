import chalk from "chalk";
import { CommandModule } from "yargs";

import { getAndVerifyCredentials } from "../utils/credentials";
import {
  downloadGithubFolder,
  saveEnvVariablesToFile,
} from "../utils/fileSave";
import { createPlaygroundQuery } from "../utils/playgroundQuery";

const inquirer = require("inquirer");

const command = "rpc";
const describe = "Interface with Retool RPC.";
const builder = {};
const handler = async function (argv: any) {
  const credentials = getAndVerifyCredentials();
  const origin = credentials.origin;

  const { rpcResourceId } = (await inquirer.prompt([
    {
      name: "rpcResourceId",
      message: "What is your RPC resource ID?",
      type: "input",
    },
  ])) as { rpcResourceId: string };

  let resourceId: number;
  if (rpcResourceId === "") {
    console.log("Please enter a valid RPC resource ID");
    return;
  } else {
    resourceId = 4;
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

  const queryResult = await createPlaygroundQuery(resourceId, credentials);

  console.log("Creating app...");

  const urlPath =
    "https://api.github.com/repos/tryretool/retool-examples/contents/" +
    appType +
    "/typescript";
  await downloadGithubFolder(urlPath, destinationPath);

  const envVariables = {
    RETOOL_SDK_ID: rpcResourceId,
    RETOOL_SDK_HOST: origin,
    RETOOL_SDK_API_TOKEN: rpcAccessToken,
  };
  saveEnvVariablesToFile(envVariables, destinationPath + "/.env");

  console.log("Done! 🎉\n");

  console.log("To run your app, run the following commands:");
  console.log(`cd ${destinationPath}`);
  console.log("yarn install");
  console.log("yarn example");
  console.log(
    `${chalk.bold("Test example query in browser:")} ${
      credentials.origin
    }/queryLibrary/${queryResult.id}`
  );
};

const commandModule: CommandModule = {
  command,
  describe,
  builder,
  handler,
};

export default commandModule;
