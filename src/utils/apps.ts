const fetch = require("node-fetch");
const ora = require("ora");

import { getCredentials } from "./credentials";

// Generates an app based on this template: https://retool.com/templates/postgresql-admin-panel
export async function generateApp(tableName: string) {
  const credentials = getCredentials();
  if (!credentials) {
    return;
  }

  const httpHeaders = {
    accept: "application/json",
    "content-type": "application/json",
    "x-xsrf-token": credentials.xsrf,
    cookie: `accessToken=${credentials.accessToken};`,
  };

  const spinner = ora("Creating app").start();

  const app = await fetch(
    `https://${credentials.domain}/api/pages/cloneTemplate`,
    {
      headers: httpHeaders,
      body: JSON.stringify({
        templateId: "postgresql-admin-panel",
        newPageName: `${tableName} CRUD App`,
      }),
      method: "POST",
    }
  );

  spinner.stop();

  const appRes = await app.json();
  if (appRes.newPage?.uuid) {
    console.log("App created successfully!");
    console.log(
      `View it: https://${credentials.domain}/apps/${appRes.newPage.uuid}/`
    );
  } else {
    console.log("Error creating app: ");
    console.log(appRes);
    return;
  }
}
