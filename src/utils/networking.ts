const axios = require("axios");

export async function retoolPost(url: string, body: any, exitOnFailure = true) {
  try {
    const response = await axios.post(url, {
      ...body,
    });
    return response;
  } catch (error: any) {
    handleError(error, exitOnFailure);
  }
}

export async function retoolGet(url: string, exitOnFailure = true) {
  try {
    const response = await axios.get(url);
    return response;
  } catch (error: any) {
    handleError(error, exitOnFailure);
  }
}

function handleError(error: any, exitOnFailure = true) {
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
    process.exit(1);
  }
}
