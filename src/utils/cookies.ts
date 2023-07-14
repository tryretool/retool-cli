export function accessTokenFromCookies(cookies: string[]): string | undefined {
  for (const cookie of cookies) {
    // Matches everything between accessToken= and ;
    const matches = cookie.match(/accessToken=([^;]+)/);
    if (matches) {
      // The first match includes "accessToken=", so we want the second match.
      return matches[1];
    }
  }
}

export function xsrfTokenFromCookies(cookies: string[]): string | undefined {
  for (const cookie of cookies) {
    // Matches everything between xsrfToken= and ;
    const matches = cookie.match(/xsrfToken=([^;]+)/);
    if (matches) {
      // The first match includes "xsrfToken=", so we want the second match.
      return matches[1];
    }
  }
}
