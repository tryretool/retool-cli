import { CommandModule } from "yargs";

import { getAndVerifyCredentialsWithRetoolDB } from "../utils/credentials";
import { dateOptions } from "../utils/date";
import { logDAU } from "../utils/telemetry";
import {
  Workflow,
  deleteWorkflow,
  getWorkflowsAndFolders,
} from "../utils/workflows";

const command = "workflows";
const describe = "Interface with Retool Workflows.";
const builder: CommandModule["builder"] = {
  list: {
    alias: "l",
    describe: `List folders and workflows at root level. Optionally provide a folder name to list all workflows in that folder. Usage:
    retool workflows -l [folder-name]`,
  },
  "list-recursive": {
    alias: "r",
    describe: `List all apps and workflows.`,
  },
  delete: {
    alias: "d",
    describe: `Delete a workflow. Usage:
      retool workflows -d <workflow-name>`,
    type: "array",
  },
};
const handler = async function (argv: any) {
  const credentials = await getAndVerifyCredentialsWithRetoolDB();
  // fire and forget
  void logDAU(credentials);

  // Handle `retool workflows -l`
  if (argv.list || argv.r) {
    let { workflows, folders } = await getWorkflowsAndFolders(credentials);
    const rootFolderId = folders?.find(
      (folder) => folder.name === "root" && folder.systemFolder === true
    )?.id;
    const trashFolderId = folders?.find(
      (folder) => folder.name === "archive" && folder.systemFolder === true
    )?.id;

    // Only list workflows in the specified folder.
    if (typeof argv.list === "string") {
      const folderId = folders?.find((folder) => folder.name === argv.list)?.id;
      if (folderId) {
        const workflowsInFolder = workflows?.filter(
          (w) => w.folderId === folderId
        );
        if (workflowsInFolder && workflowsInFolder.length > 0) {
          printWorkflows(workflowsInFolder);
        } else {
          console.log(`No workflows found in ${argv.list}.`);
        }
      } else {
        console.log(`No folder named ${argv.list} found.`);
      }
    }

    // List all folders, then all workflows in root folder.
    else {
      // Filter out undesired folders/workflows.
      folders = folders?.filter((f) => f.systemFolder === false);
      workflows = workflows?.filter((w) => w.folderId !== trashFolderId);
      if (!argv.r) {
        workflows = workflows?.filter((w) => w.folderId === rootFolderId);
      }

      // Sort from oldest to newest.
      folders?.sort((a, b) => {
        return Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
      });
      workflows?.sort((a, b) => {
        return Date.parse(a.lastDeployedAt) - Date.parse(b.lastDeployedAt);
      });

      if (
        (!folders || folders.length === 0) &&
        (!workflows || workflows.length === 0)
      ) {
        console.log("No folders or workflows found.");
      } else {
        // List all folders
        if (folders && folders?.length > 0) {
          folders.forEach((folder) => {
            const date = new Date(Date.parse(folder.updatedAt));
            console.log(
              `${date.toLocaleString(undefined, dateOptions)}     📂     ${
                folder.name
              }/`
            );
          });
        }
        // List all workflows in root folder.
        printWorkflows(workflows);
      }
    }
  }

  // Handle `retool workflows -d <workflow-name>`
  else if (argv.delete) {
    const workflowNames = argv.delete;
    for (const workflowName of workflowNames) {
      await deleteWorkflow(workflowName, credentials, true);
    }
  }

  // No flag specified.
  else {
    console.log(
      "No flag specified. See `retool workflows --help` for available flags."
    );
  }
};

function printWorkflows(workflows: Array<Workflow> | undefined): void {
  if (workflows && workflows.length > 0) {
    workflows.forEach((wf) => {
      const date = new Date(Date.parse(wf.lastDeployedAt));
      console.log(
        `${date.toLocaleString(undefined, dateOptions)}     ${
          wf.isEnabled ? "🟢" : "🔴"
        }     ${wf.name}`
      );
    });
  }
}

const commandModule: CommandModule = {
  command,
  describe,
  builder,
  handler,
};

export default commandModule;
