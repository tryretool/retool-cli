import { describe, expect, jest, test } from "@jest/globals";
import axios from "axios";

import { logDAU } from "./telemetry";

jest.mock("axios");

describe("telemetry", () => {
  test("should not log anything if telemetryEnabled is false ", async () => {
    const creds = {
      origin: "",
      xsrf: "",
      accessToken: "",
      telemetryEnabled: false,
    };
    expect(await logDAU(creds, false)).toBe(false);
  });

  test("should not log anything if telemetry was sent 1 minute ago ", async () => {
    const creds = {
      origin: "",
      xsrf: "",
      accessToken: "",
      telemetryEnabled: true,
      telemetryLastSent: Date.now() - 60 * 1000,
    };
    expect(await logDAU(creds, false)).toBe(false);
  });

  test("should not log anything if telemetry was sent 11 hours ago ", async () => {
    const creds = {
      origin: "",
      xsrf: "",
      accessToken: "",
      telemetryEnabled: true,
      telemetryLastSent: Date.now() - 11 * 60 * 60 * 1000,
    };
    expect(await logDAU(creds, false)).toBe(false);
  });

  test("should log telemetry if telemetryEnabled is true and telemetryLastSent is undefined", async () => {
    const creds = {
      origin: "",
      xsrf: "",
      accessToken: "",
      telemetryEnabled: true,
    };
    // @ts-ignore
    axios.post = jest.fn().mockReturnValue({ status: 200 });
    expect(await logDAU(creds, false)).toBe(true);
  });

  test("should log telemetry if telemetryEnabled is true and telemetryLastSent is more than 12 hours ago", async () => {
    const creds = {
      origin: "",
      xsrf: "",
      accessToken: "",
      telemetryEnabled: true,
      telemetryLastSent: Date.now() - 13 * 60 * 60 * 1000,
    };
    // @ts-ignore
    axios.post = jest.fn().mockReturnValue({ status: 200 });
    expect(await logDAU(creds, false)).toBe(true);
  });
});
