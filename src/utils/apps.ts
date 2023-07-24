const ora = require("ora");

import chalk from "chalk";
import { Credentials } from "./credentials";
import { getRequest, postRequest } from "./networking";

type App = {
  uuid: string;
  name: string;
  folderId: number;
  id: string;
  protected: boolean;
  updatedAt: string;
  createdAt: string;
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

export async function deleteApp(appName: string, credentials: Credentials) {
  const allApps = await getAllApps(credentials);
  const app = allApps?.filter((app) => {
    if (app.name === appName) {
      return app;
    }
  });
  if (app?.length != 1) {
    console.log(`0 or >1 Apps named ${appName} found. 😓`);
    process.exit(1);
  }

  const spinner = ora("Deleting App").start();
  await postRequest(`https://${credentials.domain}/api/folders/deletePage`, {
    pageId: app[0].id,
  });
  spinner.stop();

  console.log(`Deleted ${appName} app. 🗑️`);
}

export async function getAllApps(
  credentials: Credentials
): Promise<Array<App> | undefined> {
  const spinner = ora(`Fetching all apps.`).start();

  const fetchAppsResponse = await getRequest(
    `https://${credentials.domain}/api/pages?mobileAppsOnly=false`
  );

  spinner.stop();

  return fetchAppsResponse?.data?.pages;
}
