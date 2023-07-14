const axios = require("axios");

// Convenience function for making network requests. Error handling is centralized here.
// If nothing is returned, the request failed and the process may exit.
export async function postRequest(
  url: string,
  body: any,
  exitOnFailure = true,
  headers = {}
) {
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

export async function getRequest(url: string, exitOnFailure = true) {
  try {
    const response = await axios.get(url);
    return response;
  } catch (error: any) {
    handleError(error, exitOnFailure, url);
  }
}

function handleError(error: any, exitOnFailure = true, url: string) {
  if (error.response) {
    // The request was made, but the server responded with a status code outside the 2xx range
    console.error("\nResponse Error:", error.response.data);
    console.error("Response Status:", error.response.status);
    console.error("Response Headers:", error.response.headers);
  } else if (error.request) {
    // The request was made, but no response was received
    console.error("\nRequest Error:", error.request);
  } else {
    // Something happened in setting up the request that triggered an error
    console.error("\nError:", error.message);
  }
  if (exitOnFailure) {
    console.trace();
    console.error(`\nFailed to make request to ${url}. Exiting.`);
    process.exit(1);
  }
}
