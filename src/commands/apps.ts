import { CommandModule } from "yargs";

import {
  collectAppName,
  createApp,
  createAppForTable,
  deleteApp,
  getAppsAndFolders,
} from "../utils/apps";
import type { App } from "../utils/apps";
import { getAndVerifyCredentialsWithRetoolDB } from "../utils/credentials";
import { dateOptions } from "../utils/date";
import {
  collectTableName,
  fetchTableInfo,
  verifyTableExists,
} from "../utils/table";

const command = "apps";
const describe = "Interface with Retool Apps.";
const builder: CommandModule["builder"] = {
  create: {
    alias: "c",
    describe: `Create a new app.`,
  },
  "create-from-table": {
    alias: "t",
    describe: `Create a new app to visualize a Retool DB table.`,
  },
  list: {
    alias: "l",
    describe: `List folders and apps at root level. Optionally provide a folder name to list all apps in that folder. Usage:
      retool apps -l [folder-name]`,
  },
  "list-recursive": {
    alias: "r",
    describe: `List all apps and folders.`,
  },
  delete: {
    alias: "d",
    describe: `Delete an app. Usage:
      retool db -d <app-name>`,
    type: "string",
    nargs: 1,
  },
};
const handler = async function (argv: any) {
  const credentials = await getAndVerifyCredentialsWithRetoolDB();

  // Handle `retool apps --list [folder-name]`
  if (argv.list || argv.r) {
    let { apps, folders } = await getAppsAndFolders(credentials);
    const rootFolderId = folders?.find(
      (folder) => folder.name === "root" && folder.systemFolder === true
    )?.id;
    const trashFolderId = folders?.find(
      (folder) => folder.name === "archive" && folder.systemFolder === true
    )?.id;

    // Only list apps in the specified folder.
    if (typeof argv.list === "string") {
      const folderId = folders?.find((folder) => folder.name === argv.list)?.id;
      if (folderId) {
        const appsInFolder = apps?.filter((app) => app.folderId === folderId);
        if (appsInFolder && appsInFolder.length > 0) {
          printApps(appsInFolder);
        } else {
          console.log(`No apps found in ${argv.list}.`);
        }
      } else {
        console.log(`No folder named ${argv.list} found.`);
      }
    }

    // List all folders, then all apps in root folder.
    else {
      // Filter out undesired folders/apps.
      folders = folders?.filter((folder) => folder.systemFolder === false);
      apps = apps?.filter((app) => app.folderId !== trashFolderId);
      if (!argv.r) {
        apps = apps?.filter((app) => app.folderId === rootFolderId);
      }

      // Sort from oldest to newest.
      folders?.sort((a, b) => {
        return Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
      });
      apps?.sort((a, b) => {
        return Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
      });

      if ((!folders || folders.length === 0) && (!apps || apps.length === 0)) {
        console.log("No folders or apps found.");
      } else {
        // List all folders
        if (folders && folders?.length > 0) {
          folders.forEach((folder) => {
            const date = new Date(Date.parse(folder.updatedAt));
            console.log(
              `${date.toLocaleString(undefined, dateOptions)}     📂     ${
                folder.name
              }/`
            );
          });
        }
        // List all apps in root folder.
        printApps(apps);
      }
    }
  }

  // Handle `retool apps --create-from-table`
  else if (argv.t) {
    const tableName = await collectTableName();
    await verifyTableExists(tableName, credentials);
    const tableInfo = await fetchTableInfo(tableName, credentials);
    if (!tableInfo) {
      console.error(`Table ${tableName} info not found.`);
      process.exit(1);
    }
    const appName = await collectAppName();
    // Use the first non-pkey column as the search column.
    const searchColumnName = tableInfo.fields.find(
      (field) => field.name !== tableInfo.primaryKeyColumn
    )?.name;

    await createAppForTable(
      appName,
      tableName,
      searchColumnName || tableInfo.primaryKeyColumn,
      credentials
    );
  }

  // Handle `retool apps --create`
  else if (argv.create) {
    const appName = await collectAppName();
    await createApp(appName, credentials);
  }

  // Handle `retool apps -d <app-name>`
  else if (argv.delete) {
    await deleteApp(argv.delete, credentials, true);
  }

  // No flag specified.
  else {
    console.log(
      "No flag specified. See `retool apps --help` for available flags."
    );
  }
};

function printApps(apps: Array<App> | undefined): void {
  if (apps && apps?.length > 0) {
    apps.forEach((app) => {
      const date = new Date(Date.parse(app.updatedAt));
      console.log(
        `${date.toLocaleString(undefined, dateOptions)}     ${
          app.isGlobalWidget ? "🔧" : "💻"
        }     ${app.name}`
      );
    });
  }
}

const commandModule: CommandModule = {
  command,
  describe,
  builder,
  handler,
};

export default commandModule;
