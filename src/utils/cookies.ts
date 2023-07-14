export function accessTokenFromCookie(cookie: string): string | undefined {
  // Matches everything between accessToken= and ;
  const accessTokenRegex = /accessToken=([^;]+)/;
  const accessTokenMatches = cookie.match(accessTokenRegex);
  // The first match includes "accessToken=", so we want the second match.
  if (accessTokenMatches && accessTokenMatches.length > 1) {
    return accessTokenMatches[1];
  }
}

export function xsrfTokenFromCookie(cookie: string): string | undefined {
  const xsrfTokenRegex = /xsrfToken=([^;]+)/;
  const xsrfTokenMatches = cookie.match(xsrfTokenRegex);
  if (xsrfTokenMatches && xsrfTokenMatches.length > 1) {
    return xsrfTokenMatches[1];
  }
}

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
