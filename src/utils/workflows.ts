const fetch = require("node-fetch");
const ora = require("ora");

import { generateWorkflowMetadata } from "./puppeteer";
import { getCredentials } from "./credentials";

// Generates a CRUD workflow from a template.
export async function generateWorkflow(tableName: string) {
  const credentials = getCredentials();
  if (!credentials) {
    return;
  }

  let spinner = ora("Creating workflow").start();

  // Generate workflow metadata via puppeteer.
  const workflowMeta = await generateWorkflowMetadata(tableName);
  const payload = {
    name: workflowMeta.name,
    crontab: workflowMeta.crontab,
    fromTemplate: true,
    templateData: workflowMeta.templateData,
    timezone: workflowMeta.timezone,
    triggerWebhooks: workflowMeta.triggerWebhooks,
    blockData: workflowMeta.blockData,
  };
  const httpHeaders = {
    accept: "application/json",
    "content-type": "application/json",
    "x-xsrf-token": credentials.xsrf,
    cookie: `accessToken=${credentials.accessToken};`,
  };

  // Create workflow.
  const workflow = await fetch(`https://${credentials.domain}/api/workflow`, {
    headers: httpHeaders,
    body: JSON.stringify(payload),
    method: "POST",
  });
  const workflowRes = await workflow.json();
  spinner.stop();
  if (workflowRes.id) {
    console.log("Workflow created successfully!");
    console.log(
      `View it: https://${credentials.domain}/workflows/${workflowRes.id}`
    );
  } else {
    console.log("Error creating workflow: ");
    console.log(workflowRes);
    return;
  }

  // Enable workflow.
  spinner = ora("Deploying workflow").start();
  const enable = await fetch(
    `https://${credentials.domain}/api/workflow/${workflowRes.id}`,
    {
      headers: httpHeaders,
      body: JSON.stringify({ isEnabled: true }),
      method: "POST",
    }
  );
  const enableRes = await enable.json();
  spinner.stop();
  if (enableRes.isEnabled) {
    console.log("Workflow successfully deployed!");
    const curlCommand = `curl -X POST --url "http://${credentials.domain}/retool/v1/workflows/${workflowRes.id}/startTrigger?workflowApiKey=${workflowRes.apiKey}" --data '{"type":"read"}' -H 'Content-Type: application/json'`;
    console.log("cURL it: ", curlCommand);
  } else {
    console.log("Error deploying workflow: ");
    console.log(enableRes);
    return;
  }
}
