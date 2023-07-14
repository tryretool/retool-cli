const ora = require("ora");

import { getCredentials } from "./credentials";
import { postRequest } from "./networking";

// Generates an app based on this template: https://retool.com/templates/postgresql-admin-panel
export async function generateApp(tableName: string) {
  const credentials = getCredentials();
  if (!credentials) {
    return;
  }

  const spinner = ora("Creating app").start();

  const app = await postRequest(
    `https://${credentials.domain}/api/pages/cloneTemplate`,
    {
      templateId: "postgresql-admin-panel",
      newPageName: `${tableName} CRUD App`,
    }
  );

  spinner.stop();

  if (app.data.newPage?.uuid) {
    console.log("App created successfully!");
    console.log(
      `View it: https://${credentials.domain}/apps/${app.data.newPage.uuid}/`
    );
  } else {
    console.log("Error creating app: ");
    console.log(app);
    return;
  }
}
