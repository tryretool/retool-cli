const axios = require("axios");

// Convenience function for making network requests. Error handling is centralized here.
// If nothing is returned, the request failed and the process may exit.
export async function postRequest(
  url: string,
  body: any,
  exitOnFailure = true,
  headers = {},
  shouldHandleError = true
) {
  if (!shouldHandleError) {
    return await axios.post(
      url,
      {
        ...body,
      },
      {
        headers: {
          ...headers,
        },
      }
    );
  } else {
    try {
      const response = await axios.post(
        url,
        {
          ...body,
        },
        {
          headers: {
            ...headers,
          },
        }
      );
      return response;
    } catch (error: any) {
      handleError(error, exitOnFailure, url);
    }
  }
}

export async function getRequest(url: string, exitOnFailure = true, headers = {}) {
  try {
    const response = await axios.get(url, { headers });
    return response;
  } catch (error: any) {
    handleError(error, exitOnFailure, url);
  }
}

export async function deleteRequest(url: string, exitOnFailure = true) {
  try {
    const response = await axios.delete(url);
    return response;
  } catch (error: any) {
    handleError(error, exitOnFailure, url);
  }
}

function handleError(error: any, exitOnFailure = true, url: string) {
  if (error.response) {
    // The request was made, but the server responded with a status code outside the 2xx range
    console.error("\n\nHTTP Request Error:", error.response.data);
  } else {
    console.error("\n\nNetwork error:", error.toJSON());
  }
  if (process.env.DEBUG) {
    console.error(error);
  }
  console.error(`\nFailed to make request to ${url}.`);
  if (exitOnFailure) {
    process.exit(1);
  }
}
