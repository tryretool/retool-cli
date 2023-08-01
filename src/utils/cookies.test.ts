import { describe, expect, test } from "@jest/globals";

import { accessTokenFromCookies, xsrfTokenFromCookies } from "./cookies";

const cookies = [
    "accessToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVPL8.eyJ4c3JmVG9rZW4iOiI0NWQ1ZmQ0MC00ODI5LTQ0ZmYtOWViYy1mYzk0ZGE1ZDkzN2MiLCJ2ZXJzaW9uIjoiMS4yIiwiaWF0IjoxNjkwOTEwODcwfQ.rjtgus6ml0D3wNG7QRZvSEtU0BDU5bGlJZvPc-PU-o0; Max-Age=604800; Path=/; Expires=Tue, 08 Aug 2023 17:27:50 GMT; HttpOnly; Secure; SameSite=None",
    "xsrfToken=45d5fd40-4829-44ff-9ebc-fc94da5d654w; Max-Age=604800; Path=/; Expires=Tue, 08 Aug 2023 17:27:50 GMT; Secure; SameSite=None",
    "xsrfTokenSameSite=45d5fd40-4829-44ff-9ebc-fc94da5d654w; Max-Age=604800; Path=/; Expires=Tue, 08 Aug 2023 17:27:50 GMT; HttpOnly; Secure; SameSite=Strict",
]

describe("accessTokenFromCookies", () => {
    test("should return cookie from valid response", () => {
      expect(accessTokenFromCookies(cookies)).toBe("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVPL8.eyJ4c3JmVG9rZW4iOiI0NWQ1ZmQ0MC00ODI5LTQ0ZmYtOWViYy1mYzk0ZGE1ZDkzN2MiLCJ2ZXJzaW9uIjoiMS4yIiwiaWF0IjoxNjkwOTEwODcwfQ.rjtgus6ml0D3wNG7QRZvSEtU0BDU5bGlJZvPc-PU-o0");
    });

    test("should return undefined from invalid response", () => {
        expect(accessTokenFromCookies([])).toBe(undefined);
    });
});

describe ("xsrfTokenFromCookies", () => {
    test("should return cookie from valid response", () => {
        expect(xsrfTokenFromCookies(cookies)).toBe("45d5fd40-4829-44ff-9ebc-fc94da5d654w");
    });

    test("should return undefined from invalid response", () => {
        expect(xsrfTokenFromCookies([])).toBe(undefined);
    });
});


  