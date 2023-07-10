import { deleteCredentials } from "../utils/credentials";

const command = "logout";
const desc = "Log out of Retool";
const builder = {};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handler = function (argv: any) {
  deleteCredentials();
};

export default {
  command,
  desc,
  builder,
  handler,
};
