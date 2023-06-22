const fetch = require("node-fetch");
const inquirer = require("inquirer");

import { accessTokenFromCookie, xsrfTokenFromCookie } from "../utils/cookies";
import { persistCredentials, doCredentialsExist } from "../utils/credentials";
import { isEmailValid } from "../utils/emailValidation";

exports.command = "signup";
exports.desc = "Create a Retool account";
exports.builder = {};
exports.handler = async function (argv: any) {
  // Ask user if they want to overwrite existing credentials.
  if (doCredentialsExist()) {
    const { overwrite } = await inquirer.prompt([
      {
        name: "overwrite",
        message:
          "You're already logged into Retool. Do you want to log out and create a new account?",
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
  // TODO: Add a spinner here.
  const body = JSON.stringify({
    email,
    password,
    planKey: "free",
  });
  const httpHeaders = {
    accept: "application/json",
    "content-type": "application/json",
  };
  const signupResponse = await fetch(`https://login.retool.com/api/signup`, {
    headers: httpHeaders,
    body,
    method: "POST",
  });
  const accessToken = accessTokenFromCookie(
    signupResponse.headers.get("Set-Cookie")
  );
  const xsrfToken = xsrfTokenFromCookie(
    signupResponse.headers.get("Set-Cookie")
  );
  if (!accessToken || !xsrfToken) {
    const error = await signupResponse.json();
    console.log("Please try signing up again.");
    console.log(error);
    return;
  }

  const authedHttpHeaders = {
    accept: "application/json",
    "content-type": "application/json",
    "x-xsrf-token": xsrfToken,
    cookie: `accessToken=${accessToken};`,
  };

  // Step 3: Collect a valid name/org.
  while (!name) {
    name = await collectName(authedHttpHeaders);
  }
  while (!org) {
    org = await collectOrg(authedHttpHeaders);
  }

  // Step 4: Initialize organization.
  const initializeOrganizationResponse = await fetch(
    `https://login.retool.com/api/organization/admin/initializeOrganization`,
    {
      headers: authedHttpHeaders,
      body: JSON.stringify({ subdomain: org }),
      method: "POST",
    }
  );
  if (initializeOrganizationResponse.status !== 200) {
    const error = await initializeOrganizationResponse.json();
    console.log("Please try signing up again.");
    console.log(error);
    return;
  }

  // Step 5: Persist credentials
  console.log("Account created successfully!");
  persistCredentials({
    accessToken,
    xsrf: xsrfToken,
    domain: `${org}.retool.com`,
  });
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

async function collectName(
  authedHttpHeaders: any
): Promise<string | undefined> {
  const { name } = await inquirer.prompt([
    {
      name: "name",
      message: "What is your full name?",
      type: "input",
    },
  ]);
  if (!name || name.length === 0) {
    console.log("Invalid name, try again.");
    return;
  }
  const parts = name.split(" ");
  const body = JSON.stringify({
    firstName: parts[0],
    lastName: parts[1],
  });

  const changeNameResponse = await fetch(
    `https://login.retool.com/api/user/changeName`,
    {
      headers: authedHttpHeaders,
      body,
      method: "POST",
    }
  );
  if (changeNameResponse.status !== 200) {
    const error = await changeNameResponse.json();
    console.log("Try again.");
    console.log(error);
    return;
  }

  return name;
}

async function collectOrg(authedHttpHeaders: any): Promise<string | undefined> {
  const { org } = await inquirer.prompt([
    {
      name: "org",
      message: "What is your organization name?",
      type: "input",
    },
  ]);
  if (!org || org.length === 0) {
    console.log("Invalid organization name, try again.");
    return;
  }

  const checkSubdomainAvailabilityResponse = await fetch(
    `https://login.retool.com/api/organization/admin/checkSubdomainAvailability?subdomain=${org}`,
    {
      headers: authedHttpHeaders,
      method: "GET",
    }
  );

  if (checkSubdomainAvailabilityResponse.status !== 200) {
    const error = await checkSubdomainAvailabilityResponse.json();
    console.log("Try again.");
    console.log(error);
    return;
  }

  return org;
}
