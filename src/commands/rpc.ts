import { exec } from "child_process";
import { promisify } from "util";

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

  console.log(
    `\nRetoolRPC is a way to connect to Retool from your local codebase.\n `
  );
  console.log(`The three things you'll need are:`);
  console.log(
    `1. An RPC resource on Retool (we'll create one as a part of this)`
  );
  console.log(`2. An access token to connect to Retool`);
  console.log(`3. A running server that executes your local code on Retool\n`);
  console.log("To learn more about RetoolRPC, check out our docs:");
  console.log("<DOCS LINK>\n");

  let resourceName = "";
  let resourceId = 0;

  const { resourceDisplayName } = (await inquirer.prompt([
    {
      name: "resourceDisplayName",
      message: "What would you like the name of your RetoolRPC resource to be?",
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
    `'${resourceDisplayName}' resource was created with id ${resourceName}.\n`
  );
  console.log(
    `Next, we'll need an RPC access token. You can create a new one here:`
  );
  console.log(`${origin}/settings/api\n`);

  const { rpcAccessToken } = (await inquirer.prompt([
    {
      name: "rpcAccessToken",
      message: `Enter an RPC access token.`,
      type: "password",
      validate: async (rpcAccessToken: string) => {
        try {
          const validateResourceAccess = await postRequest(
            `${origin}/api/v1/retoolsdk/validateResourceAccess`,
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

  const languageType = "typescript";

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

  const envVariables = {
    RETOOL_SDK_ID: resourceName,
    RETOOL_SDK_HOST: origin,
    RETOOL_SDK_API_TOKEN: rpcAccessToken,
  };
  saveEnvVariablesToFile(envVariables, destinationPath + "/.env");

  await installYarnDependencies(destinationPath);

  spinner.stop();

  console.log(
    `\nTo help you get started, we've added starter code for you to connect to Retool. The code is located at ${destinationPath}/src/index.ts.\n`
  );
  console.log(
    `For Retool to interact with your code, start the server by completing the following steps:`
  );
  console.log(`cd ${destinationPath} && yarn example\n`);
  console.log(
    "Once your server is running, run the following query in Retool to see how it interacts with your local codebase:"
  );
  console.log(`${origin}/queryLibrary/${queryResult.id}\n`);
};

async function installYarnDependencies(destinationPath: string) {
  const executeCommand = promisify(exec);
  try {
    await executeCommand("yarn install", { cwd: destinationPath });
  } catch (error: any) {
    console.error(`Error installing Yarn dependencies: ${error.message}`);
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
