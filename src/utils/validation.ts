import { Credentials } from "./credentials";

/* eslint-disable */
const emailRegex =
  /^[-!#$%&'*+\/0-9=?A-Z^_a-z{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/;
/* eslint-enable */

//https://stackoverflow.com/questions/52456065/how-to-format-and-validate-email-node-js
export function isEmailValid(email: string) {
  if (!email) return false;
  if (email.length > 254) return false;
  if (!emailRegex.test(email)) return false;

  // Further checking of some things regex can't handle
  const parts = email.split("@");
  if (parts[0].length > 64) return false;

  const domainParts = parts[1].split(".");
  if (
    domainParts.some(function (part) {
      return part.length > 63;
    })
  )
    return false;

  return true;
}

export function isDomainValid(domain: string) {
  // https://www.regextester.com/23
  const hostnameRegEx =
    /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/;
  if (domain.match(hostnameRegEx)) {
    return true;
  }
  return false;
}

export function isXsrfValid(xsrf: string) {
  // https://stackoverflow.com/questions/7905929/how-to-test-valid-uuid-guid
  const uuidRegEx =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  if (xsrf.match(uuidRegEx)) {
    return true;
  }
  return false;
}

export function isAccessTokenValid(accessToken: string) {
  // https://stackoverflow.com/questions/61802832/regex-to-match-jwt
  const jwtRegEx = /^[\w-]+\.[\w-]+\.[\w-]+$/;
  if (accessToken.match(jwtRegEx)) {
    return true;
  }
  return false;
}
