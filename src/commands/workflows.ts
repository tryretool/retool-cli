import { CommandModule } from "yargs";

import { getAndVerifyFullCredentials } from "../utils/credentials";
import { deleteWorkflow, getAllWorkflows } from "../utils/workflows";

const command = "workflows";
const describe = "Interface with Retool Workflows.";
const builder: CommandModule["builder"] = {
  list: {
    alias: "l",
    describe: "List all Retool Workflows.",
  },
  delete: {
    alias: "d",
    describe: `Delete a workflow. Usage:
      retool workflows -d <workflow-name>`,
    type: "string",
    nargs: 1,
  },
};
const handler = async function (argv: any) {
  const credentials = await getAndVerifyFullCredentials();

  // Handle `retool workflows -l`
  if (argv.list) {
    const workflows = await getAllWorkflows(credentials);
    if (workflows && workflows.length > 0) {
      console.log("Retool Workflows:");
      workflows.forEach((wf) => {
        console.log(wf.name);
      });
    } else {
      console.log("No workflows found.");
    }
  }

  // Handle `retool workflows -d <workflow-name>`
  else if (argv.delete) {
    await deleteWorkflow(argv.delete, credentials, true);
  }

  // No flag specified.
  else {
    console.log(
      "No flag specified. See `retool workflows --help` for available flags."
    );
  }
};

const commandModule: CommandModule = {
  command,
  describe,
  builder,
  handler,
};

export default commandModule;
