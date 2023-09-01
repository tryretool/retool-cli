import { Credentials, getCredentials, persistCredentials } from "./credentials";
import { postRequest } from "./networking";
// @ts-ignore
import { version } from "../../package.json";

export async function logDAU(
  credentials?: Credentials,
  persistCreds = true
): Promise<boolean> {
  credentials = credentials || getCredentials();
  const twelveHours = 12 * 60 * 60 * 1000;

  // Don't send telemetry if user has opted out or if we've already sent telemetry in the last 12 hours.
  if (
    !credentials ||
    credentials.telemetryEnabled !== true ||
    (credentials.telemetryLastSent &&
      Date.now() - credentials.telemetryLastSent < twelveHours)
  ) {
    return false;
  }

  const payload = {
    "CLI Version": version,
    email: credentials.email,
    origin: credentials.origin,
    os: process.platform,
  };

  // Send a POST request to Retool's telemetry endpoint.
  const res = await postRequest(`https://p.retool.com/v2/p`, {
    event: "CLI DAU",
    properties: payload,
  });

  if (res.status === 200) {
    // Update the last time we sent telemetry.
    credentials.telemetryLastSent = Date.now();
    if (persistCreds) {
      persistCredentials(credentials);
    }
    return true;
  }

  return false;
}
