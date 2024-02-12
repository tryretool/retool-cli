import { execSync } from "child_process";

import chalk from "chalk";
import { format } from "date-fns";
import ora from "ora";
import { CommandModule } from "yargs";

import { getAndVerifyCredentials } from "../utils/credentials";
import {
  downloadGithubSubfolder,
  saveEnvVariablesToFile,
} from "../utils/fileSave";
import { postRequest } from "../utils/networking";
import { createPlaygroundQuery } from "../utils/playgroundQuery";
import { createResource } from "../utils/resources";
import { logDAU } from "../utils/telemetry";

const inquirer = require("inquirer");

const command = "rpc";
const describe = "Interface with Retool RPC.";
const builder = {};
const handler = async function () {
  const credentials = await getAndVerifyCredentials();
  const origin = credentials.origin;
  // fire and forget
  void logDAU(credentials);

  console.log("\n┛");
  console.log(
    ` Retool RPC connects Retool to your codebase, allowing you to register functions to execute from your Retool apps.\n`
  );
  console.log(`To start using RetoolRPC, we'll run through three steps:`);
  console.log(
    `1. ${chalk.bold(
      "Creating an RPC resource on Retool"
    )} - So Retool can communicate with your instance`
  );
  console.log(
    `2. ${chalk.bold(
      "Generating an access token"
    )} - So your server can be authenticated`
  );
  console.log(
    `3. ${chalk.bold(
      "Registering your Retool RPC server"
    )} - So Retool can reach your codebase`
  );
  console.log("┓\n");

  console.log("Looking for more information? Visit our docs:");
  console.log("https://docs.retool.com/private/retool-rpc\n");

  let resourceName = "";
  let resourceId = 0;

  const { resourceDisplayName } = (await inquirer.prompt([
    {
      name: "resourceDisplayName",
      message: "What would you like to name your Retool RPC resource?",
      type: "input",
      default: getDefaultRPCResourceName(),
      validate: async (displayName: string) => {
        try {
          const resource = await createResource({
            resourceType: "retoolSdk",
            credentials,
            resourceOptions: {
              requireExplicitVersion: false,
            },
            displayName,
          });
          resourceName = resource.name;
          resourceId = resource.id;
          return true;
        } catch (error: any) {
          return (
            error.response?.data?.message ||
            error.response?.statusText ||
            "API call failed creating resource"
          );
        }
      },
    },
  ])) as { resourceDisplayName: string };

  console.log(
    `'${resourceDisplayName}' resource was created with a resource id of ${resourceName}.\n`
  );
  console.log(
    `Next, we'll need an access token with RPC scope. You can create a new token here:`
  );
  console.log(`${origin}/settings/api\n`);

  const { rpcAccessToken } = (await inquirer.prompt([
    {
      name: "rpcAccessToken",
      message: `Enter the RPC access token.`,
      type: "password",
      validate: async (rpcAccessToken: string) => {
        try {
          const validateResourceAccess = await postRequest(
            `${origin}/api/v1/retoolrpc/validateResourceAccess`,
            {
              resourceId: resourceName,
              environmentName: "production",
            },
            false,
            {
              Authorization: `Bearer ${rpcAccessToken}`,
              "Content-Type": "application/json",
              cookie: "",
              "x-xsrf-token": "",
            },
            false
          );
          return validateResourceAccess.data.success;
        } catch (error: any) {
          return "Unable to access RPC resource. Did you enter a valid access token?";
        }
      },
    },
  ])) as { rpcAccessToken: string };
  console.log();

  const { languageType } = (await inquirer.prompt([
    {
      name: "languageType",
      message:
        "Which of the following languages would you like to use for your local RPC server?",
      type: "list",
      choices: [
        {
          name: "Typescript",
          value: "typescript",
        },
        {
          name: "Javascript",
          value: "javascript",
        },
        {
          name: "Python",
          value: "python",
        },
      ],
    },
  ])) as { languageType: string };

  const { destinationPath } = (await inquirer.prompt([
    {
      name: "destinationPath",
      message: "Where would you like to create your local server?",
      type: "input",
      default: "./retool_rpc",
    },
  ])) as { destinationPath: string };

  const githubUrl =
    "https://api.github.com/repos/tryretool/retool-examples/tarball/main";
  const subfolderPath = "rpc/" + languageType;
  await downloadGithubSubfolder(githubUrl, subfolderPath, destinationPath);

  const spinner = ora(
    "Installing dependencies and creating starter code to connect to Retool..."
  ).start();

  const queryResult = await createPlaygroundQuery(resourceId, credentials);
  const queryUrl = `${origin}/queryLibrary/${queryResult.id}`;

  const cliGeneratedMessage = `'Run the following query in Retool to see how it interacts with your local codebase:\n${queryUrl}'`;
  const envVariables = {
    RETOOL_RPC_RESOURCE_ID: resourceName,
    RETOOL_RPC_HOST: origin,
    RETOOL_RPC_API_TOKEN: rpcAccessToken,
    CLI_GENERATED_MESSAGE: `${cliGeneratedMessage}`,
  };
  saveEnvVariablesToFile(envVariables, destinationPath + "/.env");

  let runCommand = "";
  let filePath = "";
  if (languageType === "typescript" || languageType === "javascript") {
    installYarnDependencies(destinationPath);
    runCommand = "yarn example";
    if (languageType === "typescript") {
      filePath = "src/index.ts";
    } else {
      filePath = "src/index.js";
    }
  }
  if (languageType === "python") {
    installPoetryDependencies(destinationPath);
    runCommand = "poetry run python src/example.py";
    filePath = "src/example.py";
  }

  spinner.stop();

  console.log(
    `\nTo help you get started, we've added starter code that spins up a server for you to connect to Retool. The code is located at ${destinationPath}/${filePath}.\n`
  );
  console.log(`Start your server by running the following command:`);
  console.log(`${chalk.bold(`cd ${destinationPath} && ${runCommand}\n`)}`);
  console.log(
    "Once your server is running, run the following query in Retool to see how it interacts with your local codebase:"
  );
  console.log(`${queryUrl}\n`);
};

function installYarnDependencies(destinationPath: string) {
  try {
    execSync(`cd ${destinationPath} && yarn install`, { stdio: "inherit" });
  } catch (error: any) {
    console.error(`Error installing dependencies: ${error.message}`);
    process.exit(1);
  }
}

function installPoetryDependencies(destinationPath: string) {
  try {
    execSync(
      `cd ${destinationPath} && curl -sSL https://install.python-poetry.org | python3 - && poetry install`,
      { stdio: "inherit" }
    );
  } catch (error) {
    console.error("Error installing dependencies:", error);
    process.exit(1);
  }
}

function getDefaultRPCResourceName() {
  const formattedDate = format(new Date(), "MMMM d, yyyy h:mm a'");
  return `CLI Generated Resource [${formattedDate}]`;
}

const commandModule: CommandModule = {
  command,
  describe,
  builder,
  handler,
};

export default commandModule;
