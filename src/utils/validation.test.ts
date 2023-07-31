import { describe, expect, test } from "@jest/globals";

import {
  isAccessTokenValid,
  isEmailValid,
  isOriginValid,
  isXsrfValid,
} from "./validation";

describe("isEmailValid", () => {
  test("should return true for valid email", () => {
    expect(isEmailValid("hacker@retool.com")).toBe(true);
  });

  test("should return false for missing @", () => {
    expect(isEmailValid("hackerretool.com")).toBe(false);
  });

  test("should return false for missing user name", () => {
    expect(isEmailValid("@retool.com")).toBe(false);
  });

  test("should return false for missing domain name", () => {
    expect(isEmailValid("hacker@com")).toBe(false);
  });

  test("should return false for missing domain", () => {
    expect(isEmailValid("hacker@retool")).toBe(false);
  });
});

describe("isAccessTokenValid", () => {
  test("should return true for valid access token", () => {
    expect(
      isAccessTokenValid(
        "eyJhbGciOiJIUzOOPiIsInR5cCI6IkpXVCJ9.eyJ4c3JmVG9rZW4iOiJjYzRjNmM3MC0wN2ZmLTQzNzktODI5ZS0wZDgyOWE1YjRiZTQiLCJ2ZXJzaW9uIjoiMS4yIiwiaWF0IjoxNjkwODIxMDUxfQ.-BjHNN9N9fDteokZmoIjdL0CbcZnkYKVCYwuzYugTzQ"
      )
    ).toBe(true);
  });

  test("should return false for invalid access token", () => {
    expect(isAccessTokenValid("asdasdasd")).toBe(false);
  });
});

describe("isOriginValid", () => {
  test("should return true for valid https origin", () => {
    expect(isOriginValid("https://subdomain.retool.com")).toBe(true);
  });

  test("should return true for valid http origin", () => {
    expect(isOriginValid("http://subdomain.retool.com")).toBe(true);
  });

  test("should return false for missing http://", () => {
    expect(isOriginValid("hacker.retool.com")).toBe(false);
  });

  test("should return false for ending with /", () => {
    expect(isOriginValid("http://hacker.retool.com/")).toBe(false);
  });
});

describe("isXsrfValid", () => {
  test("should return true for valid xsrf", () => {
    expect(isXsrfValid("cc4c6c70-07ff-4379-829e-0d829a5b4be4")).toBe(true);
  });

  test("should return false for invalid xsrf", () => {
    expect(isXsrfValid("asdasdasd")).toBe(false);
  });
});
