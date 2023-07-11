const fetch = require("node-fetch");
const ora = require("ora");

import { generateWorkflowMetadata } from "./puppeteer";
import { getCredentials } from "./credentials";

// Generates a CRUD workflow from a template.
export async function generateWorkflow() {
  const credentials = getCredentials();
  if (!credentials) {
    return;
  }

  const spinner = ora("Creating workflow").start();
  // TODO: Pass in table name
  const workflowMeta = await generateWorkflowMetadata("TABLE_NAME");

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

  const workflow = await fetch(`https://${credentials.domain}/api/workflow`, {
    headers: httpHeaders,
    body: JSON.stringify(payload),
    method: "POST",
  });
  const res = await workflow.json();
  spinner.stop();
  if (res.id) {
    console.log("Workflow created successfully");
    console.log(`https://${credentials.domain}/workflows/${res.id}`);
  } else {
    console.log("Error creating workflow: ");
    console.log(res);
  }
}
