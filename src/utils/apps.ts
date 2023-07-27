import chalk from "chalk";

import { Credentials } from "./credentials";
import { getRequest, postRequest } from "./networking";

const inquirer = require("inquirer");
const ora = require("ora");

export type App = {
  uuid: string;
  name: string;
  folderId: number;
  id: string;
  protected: boolean;
  updatedAt: string;
  createdAt: string;
  isGlobalWidget: boolean; // is a module
};

type Folder = {
  id: number;
  parentFolderId: number;
  name: string;
  systemFolder: boolean;
  createdAt: string;
  updatedAt: string;
  folderType: string;
  accessLevel: string;
};

export async function createApp(
  appName: string,
  credentials: Credentials
): Promise<App | undefined> {
  const spinner = ora("Creating App").start();

  const createAppResult = await postRequest(
    `https://${credentials.domain}/api/pages/createPage`,
    {
      pageName: appName,
      isGlobalWidget: false,
      isMobileApp: false,
      multiScreenMobileApp: false,
    }
  );
  spinner.stop();

  const { page } = createAppResult.data;
  if (!page?.uuid) {
    console.log("Error creating app.");
    console.log(createAppResult.data);
    process.exit(1);
  } else {
    console.log("Successfully created an App. 🎉");
    console.log(
      `${chalk.bold("View in browser:")} https://${credentials.domain}/editor/${
        page.uuid
      }`
    );
    return page;
  }
}

export async function deleteApp(
  appName: string,
  credentials: Credentials,
  confirmDeletion: boolean
) {
  if (confirmDeletion) {
    const { confirm } = await inquirer.prompt([
      {
        name: "confirm",
        message: `Are you sure you want to delete ${appName}?`,
        type: "confirm",
      },
    ]);
    if (!confirm) {
      process.exit(0);
    }
  }

  // Verify that the provided appName exists.
  const { apps } = await getAppsAndFolders(credentials);
  const app = apps?.filter((app) => {
    if (app.name === appName) {
      return app;
    }
  });
  if (app?.length != 1) {
    console.log(`0 or >1 Apps named ${appName} found. 😓`);
    process.exit(1);
  }

  // Delete the app.
  const spinner = ora("Deleting App").start();
  await postRequest(`https://${credentials.domain}/api/folders/deletePage`, {
    pageId: app[0].id,
  });
  spinner.stop();

  console.log(`Deleted ${appName} app. 🗑️`);
}

export async function getAppsAndFolders(
  credentials: Credentials
): Promise<{ apps?: Array<App>; folders?: Array<Folder> }> {
  const spinner = ora(`Fetching all apps.`).start();

  const fetchAppsResponse = await getRequest(
    `https://${credentials.domain}/api/pages?mobileAppsOnly=false`
  );

  spinner.stop();

  return {
    apps: fetchAppsResponse?.data?.pages,
    folders: fetchAppsResponse?.data?.folders,
  };
}

export async function collectAppName(): Promise<string> {
  const { appName } = await inquirer.prompt([
    {
      name: "appName",
      message: "App name?",
      type: "input",
    },
  ]);

  if (appName.length === 0) {
    console.log("Error: App name cannot be blank.");
    process.exit(1);
  }

  // Remove spaces from app name.
  return appName.replace(/\s/g, "_");
}
