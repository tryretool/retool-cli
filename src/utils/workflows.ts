const chalk = require("chalk");
const ora = require("ora");

import { generateWorkflowMetadata } from "./puppeteer";
import { Credentials, getCredentials } from "./credentials";
import { deleteRequest, getRequest, postRequest } from "./networking";

type Workflow = {
  id: string; //UUID
  name: string;
  isEnabled: boolean;
  protected: boolean;
  deployedBy: string;
};

// Fetch all existing Workflows.
export async function fetchAllWorkflows(
  credentials: Credentials
): Promise<Array<Workflow> | undefined> {
  const spinner = ora("Fetching Workflows").start();
  const fetchWorkflowsResponse = await getRequest(
    `https://${credentials.domain}/api/workflow`
  );
  spinner.stop();

  if (fetchWorkflowsResponse.data) {
    return fetchWorkflowsResponse.data.workflowsMetadata;
  }
}

export async function deleteWorkflow(
  workflowName: string,
  credentials: Credentials
) {
  // Verify that the provided workflowName exists.
  const allWorkflows = await fetchAllWorkflows(credentials);
  const workflow = allWorkflows?.filter((workflow) => {
    if (workflow.name === workflowName) {
      return workflow;
    }
  });
  if (workflow?.length != 1) {
    console.log(`0 or >1 Workflows named ${workflowName} found. 😓`);
    process.exit(1);
  }

  // Delete the Workflow.
  const spinner = ora(`Deleting ${workflowName}`).start();
  await deleteRequest(
    `https://${credentials.domain}/api/workflow/${workflow[0].id}`
  );
  spinner.stop();

  console.log(`Deleted ${workflowName}. 🗑️`);
}

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
    console.log("Successfully created a workflow. 🎉");
    console.log(
      `${chalk.bold("View in browser:")} https://${
        credentials.domain
      }/workflows/${workflow.data.id}`
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
  console.log("Successfully deployed a workflow. 🚀");
  const domainParts = credentials.domain.split(".");
  if (workflow.data.apiKey && domainParts.length === 3) {
    const curlCommand = `curl -X POST --url "https://api.${domainParts[1]}.${domainParts[2]}/v1/workflows/${workflow.data.id}/startTrigger?workflowApiKey=${workflow.data.apiKey}" --data '{"type":"read"}' -H 'Content-Type: application/json'`;
    console.log(
      `Retool Cloud users can ${chalk.bold("cURL it:")} ${curlCommand}`
    );
  }
}
