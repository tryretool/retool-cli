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
