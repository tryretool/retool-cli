import { deleteCredentials } from "../utils/credentials";

export const command = "logout";
export const desc = "Log out of Retool";
export const builder = {};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const handler = function (argv: any) {
  deleteCredentials();
};
