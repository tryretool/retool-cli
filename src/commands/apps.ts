import type { DateTimeFormatOptions } from "intl";
import { CommandModule } from "yargs";

import {
  collectAppName,
  createApp,
  deleteApp,
  getAllApps,
} from "../utils/apps";
import { getAndVerifyFullCredentials } from "../utils/credentials";

// 07/19/2023, 09:07:58 PM
const dateOptions: DateTimeFormatOptions = {
  month: "2-digit",
  day: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

const command = "apps";
const describe = "Interface with Retool Apps.";
const builder: CommandModule["builder"] = {
  list: {
    alias: "l",
    describe: "List all Retool Apps.",
  },
  create: {
    alias: "c",
    describe: `Create a new app.`,
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
  const credentials = await getAndVerifyFullCredentials();

  // Handle `retool apps -l`
  if (argv.list) {
    const apps = await getAllApps(credentials);
    // Sort from oldest to newest.
    apps?.sort((a, b) => {
      return Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
    });
    if (apps && apps.length > 0) {
      apps.forEach((app) => {
        const date = new Date(Date.parse(app.updatedAt));
        console.log(
          `${date.toLocaleString(undefined, dateOptions)}     ${app.name}`
        );
      });
    } else {
      console.log("No apps found.");
    }
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

const commandModule: CommandModule = {
  command,
  describe,
  builder,
  handler,
};

export default commandModule;
