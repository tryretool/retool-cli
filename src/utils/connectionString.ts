const axios = require("axios");

import { ConnectionStringParser } from "connection-string-parser";
import { getCredentials } from "./credentials";
import { getRequest } from "./networking";

// Print a psql command to connect to the Retool DB.
// Connnection string is never persisted, it's fetched when needed.
// This is done to avoid storing the password in plaintext.
export async function logConnectionStringDetails() {
  const connectionString = await getConnectionString();
  if (connectionString) {
    const parsed = new ConnectionStringParser({
      scheme: "postgresql",
      hosts: [],
    }).parse(connectionString);
    console.log(
      `Connect via psql: \`PGPASSWORD=${parsed.password} psql -h ${parsed.hosts[0].host} -U ${parsed.username} ${parsed.endpoint}`
    );
    console.log(`Postgres Connection URL: ${connectionString}`);
  }
}

async function getConnectionString(): Promise<string | undefined> {
  const credentials = getCredentials();
  if (
    !credentials ||
    !credentials.retoolDBUuid ||
    !credentials.hasConnectionString
  ) {
    return;
  }
  axios.defaults.headers["x-xsrf-token"] = credentials.xsrf;
  axios.defaults.headers.cookie = `accessToken=${credentials.accessToken};`;
  const grid = await getRequest(
    `https://${credentials.domain}/api/grid/retooldb/${credentials.retoolDBUuid}?env=production`,
    false
  );
  return grid.data?.gridInfo?.connectionString;
}
