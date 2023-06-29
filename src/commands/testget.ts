const fetch = require("node-fetch");

import { getCredentials } from "../utils/credentials";

exports.command = "commandName";
exports.desc =
  "Description that shows when you type `retool commandName --help`";
exports.builder = {
  optionName: {
    alias: "o",
    describe:
      "I'm a command option when you type retool commandName --optionName",
    type: "string",
    nargs: 1,
  },
};
exports.handler = async function (argv: any) {
  // If you need to call retool backend
  const credentials = getCredentials();
  if (!credentials) {
    return;
  }

  if (argv.optionName) {
    const httpHeaders = {
      accept: "application/json",
      "content-type": "application/json",
      "x-xsrf-token": credentials.xsrf,
      cookie: `accessToken=${credentials.accessToken};`,
    };
    const payload = {};

    const retoolBackendResponse = await fetch(
      `https://${credentials.domain}/${argv.optionName}}`,
      {
        headers: httpHeaders,
        // body: JSON.stringify(payload),
        method: "GET",
      }
    );
    const resp = await retoolBackendResponse.text();
    console.log(resp);
  }
};
