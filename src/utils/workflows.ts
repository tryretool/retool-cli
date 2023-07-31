import { Credentials } from "./credentials";
import { deleteRequest, getRequest, postRequest } from "./networking";

const chalk = require("chalk");
const inquirer = require("inquirer");
const ora = require("ora");

export type Workflow = {
  id: string; //UUID
  name: string;
  folderId: number;
  isEnabled: boolean;
  protected: boolean;
  deployedBy: string;
  lastDeployedAt: string;
};

type WorkflowFolder = {
  id: number;
  name: string;
  systemFolder: boolean;
  parentFolderId: number;
  createdAt: string;
  updatedAt: string;
  folderType: string;
  accessLevel: string;
};

export async function getWorkflowsAndFolders(
  credentials: Credentials
): Promise<{ workflows?: Array<Workflow>; folders?: Array<WorkflowFolder> }> {
  const spinner = ora("Fetching Workflows").start();
  const fetchWorkflowsResponse = await getRequest(
    `${credentials.origin}/api/workflow`
  );
  spinner.stop();

  return {
    workflows: fetchWorkflowsResponse?.data?.workflowsMetadata,
    folders: fetchWorkflowsResponse?.data?.workflowFolders,
  };
}

export async function deleteWorkflow(
  workflowName: string,
  credentials: Credentials,
  confirmDeletion: boolean
) {
  if (confirmDeletion) {
    const { confirm } = await inquirer.prompt([
      {
        name: "confirm",
        message: `Are you sure you want to delete ${workflowName}?`,
        type: "confirm",
      },
    ]);
    if (!confirm) {
      process.exit(0);
    }
  }

  // Verify that the provided workflowName exists.
  const { workflows } = await getWorkflowsAndFolders(credentials);
  const workflow = workflows?.filter((workflow) => {
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
  await deleteRequest(`${credentials.origin}/api/workflow/${workflow[0].id}`);
  spinner.stop();

  console.log(`Deleted ${workflowName}. 🗑️`);
}

// Generates a CRUD workflow for tableName from a template.
export async function generateCRUDWorkflow(
  tableName: string,
  credentials: Credentials
) {
  let spinner = ora("Creating workflow").start();

  // Generate workflow metadata via puppeteer.
  // Dynamic import b/c puppeteer is slow.
  const workflowMeta = await import("./puppeteer").then(
    async ({ generateWorkflowMetadata }) => {
      return await generateWorkflowMetadata(tableName);
    }
  );
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
  const workflow = await postRequest(`${credentials.origin}/api/workflow`, {
    ...payload,
  });
  spinner.stop();
  if (workflow.data.id) {
    console.log("Successfully created a workflow. 🎉");
    console.log(
      `${chalk.bold("View in browser:")} ${credentials.origin}/workflows/${
        workflow.data.id
      }`
    );
  } else {
    console.log("Error creating workflow: ");
    console.log(workflow);
    return;
  }

  // Enable workflow.
  spinner = ora("Deploying workflow").start();
  await postRequest(`${credentials.origin}/api/workflow/${workflow.data.id}`, {
    isEnabled: true,
  });
  spinner.stop();
  console.log("Successfully deployed a workflow. 🚀");
  if (workflow.data.apiKey) {
    const curlCommand = `curl -X POST --url "https://api.retool.com/v1/workflows/${workflow.data.id}/startTrigger?workflowApiKey=${workflow.data.apiKey}" --data '{"type":"read"}' -H 'Content-Type: application/json'`;
    console.log(
      `Retool Cloud users can ${chalk.bold("cURL it:")} ${curlCommand}`
    );
  }
}
