const fetch = require("node-fetch");

import { ConnectionStringParser } from "connection-string-parser";
import { getCredentials } from "./credentials";

// Print a psql command to connect to the Retool DB.
// Connnection string is never persisted, it's fetched when needed.
// This is done to avoid storing the password in plaintext.
export async function printPsqlCommand() {
  const command = await getPsqlCommand();
  if (command) {
    console.log(`Connect via psql: \`${command}\``);
  }
}

async function getPsqlCommand(): Promise<string | undefined> {
  const credentials = getCredentials();
  if (
    !credentials ||
    !credentials.retoolDBUuid ||
    !credentials.hasConnectionString
  ) {
    return;
  }

  const httpHeaders = {
    accept: "application/json",
    "content-type": "application/json",
    "x-xsrf-token": credentials.xsrf,
    cookie: `accessToken=${credentials.accessToken};`,
  };
  const grid = await fetch(
    `https://${credentials.domain}/api/grid/retooldb/${credentials.retoolDBUuid}?env=production`,
    {
      headers: httpHeaders,
      method: "GET",
    }
  );
  const gridJson = await grid.json();
  if (gridJson.success && gridJson.gridInfo.connectionString) {
    const parsed = new ConnectionStringParser({
      scheme: "postgresql",
      hosts: [],
    }).parse(gridJson.gridInfo.connectionString);
    return `PGPASSWORD=${parsed.password} psql -h ${parsed.hosts[0].host} -U ${parsed.username} ${parsed.endpoint}`;
  }
}
