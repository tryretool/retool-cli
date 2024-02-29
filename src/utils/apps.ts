import chalk from "chalk";

import { Credentials } from "./credentials";
import { getRequest, postRequest } from "./networking";

const fs = require("fs");

const axios = require("axios");
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
    `${credentials.origin}/api/pages/createPage`,
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
      `${chalk.bold("View in browser:")} ${credentials.origin}/editor/${
        page.uuid
      }`
    );
    return page;
  }
}

export async function createAppForTable(
  appName: string,
  tableName: string,
  columnName: string, //The column to use for search bar.
  credentials: Credentials
) {
  const spinner = ora("Creating App").start();

  const createAppResult = await postRequest(
    `${credentials.origin}/api/pages/autogeneratePage`,
    {
      appName,
      resourceName: credentials.retoolDBUuid,
      tableName,
      columnName,
    }
  );
  spinner.stop();

  const { pageUuid } = createAppResult.data;
  if (!pageUuid) {
    console.log("Error creating app.");
    console.log(createAppResult.data);
    process.exit(1);
  } else {
    console.log("Successfully created an App. 🎉");
    console.log(
      `${chalk.bold("View in browser:")} ${
        credentials.origin
      }/editor/${pageUuid}`
    );
  }
}

export async function exportApp(appName: string, credentials: Credentials) {
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

  // Export the app.
  const spinner = ora("Exporting App").start();
  const response = await axios.post(
    `${credentials.origin}/api/pages/uuids/${app[0].uuid}/export`,
    {},
    {
      responseType: "stream",
    }
  );

  // Write the response to a file.
  try {
    const filePath = `${appName}.json`;
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
  } catch (error) {
    console.error("Error exporting app.");
    process.exit(1);
  }

  spinner.stop();
  console.log(`Exported ${appName} app. 📦`);
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
  await postRequest(`${credentials.origin}/api/folders/deletePage`, {
    pageId: app[0].id,
  });
  spinner.stop();

  console.log(`Deleted ${appName} app. 🗑️`);
}

// Fetch all apps (excluding apps in trash).
export async function getAppsAndFolders(
  credentials: Credentials
): Promise<{ apps?: Array<App>; folders?: Array<Folder> }> {
  const spinner = ora(`Fetching all apps.`).start();

  const fetchAppsResponse = await getRequest(
    `${credentials.origin}/api/pages?mobileAppsOnly=false`
  );

  spinner.stop();

  const apps: Array<App> | undefined = fetchAppsResponse?.data?.pages;
  const folders: Array<Folder> | undefined = fetchAppsResponse?.data?.folders;
  const trashFolderId = folders?.find(
    (folder) => folder.name === "archive" && folder.systemFolder === true
  )?.id;

  return {
    apps: apps?.filter((app) => app.folderId !== trashFolderId),
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
