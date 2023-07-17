const ora = require("ora");

import { generateWorkflowMetadata } from "./puppeteer";
import { getCredentials } from "./credentials";
import { postRequest } from "./networking";

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

  // Create workflow.
  const workflow = await postRequest(
    `https://${credentials.domain}/api/workflow`,
    {
      ...payload,
    }
  );
  spinner.stop();
  if (workflow.data.id) {
    console.log("Workflow created successfully!");
    console.log(
      `View it: https://${credentials.domain}/workflows/${workflow.data.id}`
    );
  } else {
    console.log("Error creating workflow: ");
    console.log(workflow);
    return;
  }

  // Enable workflow.
  spinner = ora("Deploying workflow").start();
  await postRequest(
    `https://${credentials.domain}/api/workflow/${workflow.data.id}`,
    {
      isEnabled: true,
    }
  );
  spinner.stop();
  console.log("Workflow successfully deployed!");
  const domainParts = credentials.domain.split(".");
  if (workflow.data.apiKey && domainParts.length === 3) {
    const curlCommand = `curl -X POST --url "https://api.${domainParts[1]}.${domainParts[2]}/v1/workflows/${workflow.data.id}/startTrigger?workflowApiKey=${workflow.data.apiKey}" --data '{"type":"read"}' -H 'Content-Type: application/json'`;
    console.log("Retool Cloud users can cURL it: ", curlCommand);
  }
}
