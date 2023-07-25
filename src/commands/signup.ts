import { CommandModule } from "yargs";

import { logSuccess } from "./login";
import { accessTokenFromCookies, xsrfTokenFromCookies } from "../utils/cookies";
import { doCredentialsExist, persistCredentials } from "../utils/credentials";
import { getRequest, postRequest } from "../utils/networking";
import { isEmailValid } from "../utils/validation";

const axios = require("axios");
const inquirer = require("inquirer");
const ora = require("ora");

const command = "signup";
const describe = "Create a Retool account.";
const builder = {};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handler = async function (argv: any) {
  // Ask user if they want to overwrite existing credentials.
  if (doCredentialsExist()) {
    const { overwrite } = await inquirer.prompt([
      {
        name: "overwrite",
        message:
          "You're already logged in. Do you want to log out and create a new account?",
        type: "confirm",
      },
    ]);
    if (!overwrite) {
      return;
    }
  }

  // Step 1: Collect a valid email/password.
  let email, password, name, org;
  while (!email) {
    email = await collectEmail();
  }
  while (!password) {
    password = await colllectPassword();
  }

  // Step 2: Call signup endpoint, get cookies.
  const spinner = ora(
    "Verifying that the email and password are valid on the server"
  ).start();
  const signupResponse = await postRequest(
    `https://login.retool.com/api/signup`,
    {
      email,
      password,
      planKey: "free",
    }
  );
  spinner.stop();

  const accessToken = accessTokenFromCookies(
    signupResponse.headers["set-cookie"]
  );
  const xsrfToken = xsrfTokenFromCookies(signupResponse.headers["set-cookie"]);
  if (!accessToken || !xsrfToken) {
    if (process.env.DEBUG) {
      console.log(signupResponse);
    }
    console.log(
      "Error creating account, please try again or signup at https://login.retool.com/auth/signup?plan=free."
    );
    return;
  }

  axios.defaults.headers["x-xsrf-token"] = xsrfToken;
  axios.defaults.headers.cookie = `accessToken=${accessToken};`;

  // Step 3: Collect a valid name/org.
  while (!name) {
    name = await collectName();
  }
  while (!org) {
    org = await collectOrg();
  }

  // Step 4: Initialize organization.
  await postRequest(
    `https://login.retool.com/api/organization/admin/initializeOrganization`,
    {
      subdomain: org,
    }
  );

  // Step 5: Persist credentials
  const domain = `${org}.retool.com`;
  const userRes = await getRequest(`https://${domain}/api/user`);
  persistCredentials({
    domain,
    accessToken,
    xsrf: xsrfToken,
    firstName: userRes.data.user?.firstName,
    lastName: userRes.data.user?.lastName,
    email: userRes.data.user?.email,
  });
  logSuccess();
};

async function collectEmail(): Promise<string | undefined> {
  const { email } = await inquirer.prompt([
    {
      name: "email",
      message: "What is your email?",
      type: "input",
    },
  ]);
  if (!isEmailValid(email)) {
    console.log("Invalid email, try again.");
    return;
  }
  return email;
}

async function colllectPassword(): Promise<string | undefined> {
  const { password } = await inquirer.prompt([
    {
      name: "password",
      message: "Please create a password (min 8 characters):",
      type: "password",
    },
  ]);
  const { confirmedPassword } = await inquirer.prompt([
    {
      name: "confirmedPassword",
      message: "Please confirm password:",
      type: "password",
    },
  ]);
  if (password.length < 8) {
    console.log("Password must be at least 8 characters long, try again.");
    return;
  }
  if (password !== confirmedPassword) {
    console.log("Passwords do not match, try again.");
    return;
  }
  return password;
}

async function collectName(): Promise<string | undefined> {
  const { name } = await inquirer.prompt([
    {
      name: "name",
      message: "What is your first and last name?",
      type: "input",
    },
  ]);
  if (!name || name.length === 0) {
    console.log("Invalid name, try again.");
    return;
  }
  const parts = name.split(" ");
  const changeNameResponse = await postRequest(
    `https://login.retool.com/api/user/changeName`,
    {
      firstName: parts[0],
      lastName: parts[1],
    },
    false
  );
  if (!changeNameResponse) {
    return;
  }

  return name;
}

async function collectOrg(): Promise<string | undefined> {
  let { org } = await inquirer.prompt([
    {
      name: "org",
      message:
        "What is your organization name? Leave blank to generate a random name.",
      type: "input",
    },
  ]);
  if (!org || org.length === 0) {
    // Org must start with letter, append a random string after it.
    // https://stackoverflow.com/a/8084248
    org = "z" + (Math.random() + 1).toString(36).substring(2);
  }

  const checkSubdomainAvailabilityResponse = await getRequest(
    `https://login.retool.com/api/organization/admin/checkSubdomainAvailability?subdomain=${org}`,
    false
  );

  if (!checkSubdomainAvailabilityResponse.status) {
    return;
  }

  return org;
}

const commandModule: CommandModule = { command, describe, builder, handler };
export default commandModule;
