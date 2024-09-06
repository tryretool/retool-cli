import * as fs from "fs";

import ora from "ora";
import { CommandModule } from "yargs";

import { logDAU } from "../utils/telemetry";
import { generateTerraformConfigForFolders, generateTerraformConfigForGroups, generateTerraformConfigForPermissions, importRetoolConfig } from "../utils/terraformGen";

const command: CommandModule["command"] = "terraform";
const describe: CommandModule["describe"] = `Generate Terraform configuration for the given Retool organization.

This command requires the following environment variables to be set:
- RETOOL_ACCESS_TOKEN: Access token for the Retool API. The token must have "source_control:read","groups:read","spaces:read","folders:read","permissions:all:read" scopes.
- RETOOL_HOST: The Retool host domain (e.g. your-org.retool.com).
You can also set the environment variable RETOOL_SCHEME to "http" if you are using HTTP.`;
const builder: CommandModule["builder"] = {
  imports: {
    alias: "i",
    describe: `Path of the output file with "import" blocks in it`,
  },
  config: {
    alias: "c",
    describe: `Path of the output file with Terraform resource configurations in it`,
  },
};

const handler = async function (argv: any) {
  // fire and forget
  void logDAU();

  if (!process.env.RETOOL_ACCESS_TOKEN || !process.env.RETOOL_HOST) {
    console.error("This command requires RETOOL_ACCESS_TOKEN and RETOOL_HOST environment variables to be set.");
    process.exit(1);
  }

  if (!argv.imports && !argv.config) {
    console.error("Please provide an output file path using --imports or --config flag.");
    process.exit(1);
  }

  const spinner = ora("Reading Retool configuration").start();
  const config = await importRetoolConfig();
  spinner.stop();

  if (argv.imports) {
    // Print everything into a file
    const fileContent = config.map((im) => {
      return `
import {
  to = ${im.resourceType}.${im.terraformId}
  id = "${im.id}"
}
`
    }).join("");
    fs.writeFileSync(argv.imports, fileContent);
  
    console.log("Generated Terraform file with `import` blocks.");
  }
  if (argv.config) {
    const folderResources = config.filter((resource) => resource.resourceType === "retool_folder");
    const groupResources = config.filter((resource) => resource.resourceType === "retool_group");
    const permissionResources = config.filter((resource) => resource.resourceType === "retool_permissions");
    let lines = await generateTerraformConfigForFolders(folderResources);
    lines = lines.concat(generateTerraformConfigForGroups(groupResources));
    lines = lines.concat(await generateTerraformConfigForPermissions(permissionResources, config));
    // Print everything into a file
    fs.writeFileSync(argv.config, lines.join("\n"));
  
    console.log("Generated Terraform file with `import` blocks.");
  }
};

const commandModule: CommandModule = {
  command,
  describe,
  builder,
  handler,
};

export default commandModule;
