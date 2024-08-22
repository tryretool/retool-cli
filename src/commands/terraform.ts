import * as fs from "fs";

import ora from "ora";
import { CommandModule } from "yargs";

import { getRequest } from "../utils/networking";
import { logDAU } from "../utils/telemetry";

const command: CommandModule["command"] = "terraform";
const describe: CommandModule["describe"] = "Generate Terraform configurationfile with `import` blocks for the given Retool organization.";
const builder: CommandModule["builder"] = {
  imports: {
    alias: "i",
    describe: `Generate Terraform file with "import" blocks. Usage:
    retool terraform -i <output file path>`,
  },
};

const sanitizeUnicodeName = (name: string): string => {
  return name
    .normalize('NFKD') // Normalize Unicode
    .replace(/[^\w\s-]/g, '') // Remove non-alphanumeric characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .toLowerCase(); // Convert to lowercase
};

const API_URL_PREFIX = `${process.env.RETOOL_SCHEME ?? 'https'}://${process.env.RETOOL_HOST}/api/v2`;
const AUTHORIZATION_HEADER = { Authorization: `Bearer ${process.env.RETOOL_ACCESS_TOKEN}` };

const FOLDER_TERRAFORM_IDS = new Set<string>();

const generateTerraformIdForFolder = (folderType: string, folderName: string): string => {
  let terraformId = sanitizeUnicodeName(folderName);
  if (terraformId.length <= 1 || !/^[a-z_]/.test(terraformId)) { // Ensure the terraformId starts with a letter or underscore. We also want to avoid single character terraformIds.
    terraformId = `${folderType}_folder_${terraformId}`;
  }
  if (FOLDER_TERRAFORM_IDS.has(terraformId)) {
    let seq = 1;
    while (FOLDER_TERRAFORM_IDS.has(`${terraformId}_${seq}`)) {
      seq++;
    }
    terraformId = `${terraformId}_${seq}`;
  }
  FOLDER_TERRAFORM_IDS.add(terraformId);
  return terraformId;
}

type ResourceImport = {
  id: string;
  terraformId: string;
  resourceType: string;
};

type APIFolder = { 
  id: string
  name: string
  folder_type: string
  is_system_folder: boolean 
};

const importFolders = async function (): Promise<ResourceImport[]> {
  const response = await getRequest(
    `${API_URL_PREFIX}/folders`, 
    false, 
    AUTHORIZATION_HEADER
  );
  const folders: APIFolder[] = response.data.data;
  return folders
    .sort((a, b) => a.id.localeCompare(b.id))
    .filter((folder) => !folder.is_system_folder)
    .map((folder) => ({ 
      id: folder.id, 
      terraformId: generateTerraformIdForFolder(folder.folder_type, folder.name), 
      resourceType: "retool_folder" 
    }));
}

type APIGroup = {
  id: number
  name: string
};

const GROUP_TERRAFORM_IDS = new Set<string>();
const GROUP_ID_TO_TERRAFORM_ID = new Map<string, string>();

const generateTerraformIdForGroup = (groupName: string, groupId: string): string => {
  let terraformId = sanitizeUnicodeName(groupName);
  if (terraformId.length <= 1 || !/^[a-z_]/.test(terraformId)) { // Ensure the terraformId starts with a letter or underscore. We also want to avoid single character terraformIds.
    terraformId = `group_${terraformId}`;
  }
  if (GROUP_TERRAFORM_IDS.has(terraformId)) {
    let seq = 1;
    while (GROUP_TERRAFORM_IDS.has(`${terraformId}_${seq}`)) {
      seq++;
    }
    terraformId = `${terraformId}_${seq}`;
  }
  GROUP_TERRAFORM_IDS.add(terraformId);
  GROUP_ID_TO_TERRAFORM_ID.set(groupId, terraformId);
  return terraformId;
}

const importGroups = async function (): Promise<ResourceImport[]> {
  const response = await getRequest(
    `${API_URL_PREFIX}/groups`, 
    false, 
    AUTHORIZATION_HEADER
  );
  const groups: APIGroup[] = response.data.data;
  return groups
    .sort((a, b) => a.id - b.id)
    .filter((group) => !['admin', 'viewer', 'editor', 'All Users'].includes(group.name)) // filter out predefined groups
    .map((group) => ({ 
      id: group.id.toString(), 
      terraformId: generateTerraformIdForGroup(group.name, group.id.toString()), 
      resourceType: "retool_group" 
    }));
}

const importPermissions = function (groupIds: string[]): ResourceImport[] {
  // We'll just generate imports based on the groups we fetched earlier
  return groupIds
    .map((groupId) => ({ 
      id: `group|${groupId}`, 
      terraformId: `${GROUP_ID_TO_TERRAFORM_ID.get(groupId)}_permissions`, 
      resourceType: "retool_permissions" 
    }));
}

type APISpace = {
  id: string
  name: string
  domain: string
};

const SPACE_TERRAFORM_IDS = new Set<string>();

const generateTerraformIdForSpace = (spaceDomain: string): string => {
  // the unfortunate thing here is that users can put whatever they want in the domain field, so we have to guard against that
  let terraformId = spaceDomain
    .replace(/\./g, '_')
    .replace(/[^\w\s-]/g, '') // Remove non-alphanumeric characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .toLowerCase(); // Convert to lowercase

  if (terraformId.length <= 1 || !/^[a-z_]/.test(terraformId)) { // Ensure the terraformId starts with a letter or underscore. We also want to avoid single character terraformIds.
    terraformId = `space_${terraformId}`;
  }
  if (SPACE_TERRAFORM_IDS.has(terraformId)) {
    let seq = 1;
    while (SPACE_TERRAFORM_IDS.has(`${terraformId}_${seq}`)) {
      seq++;
    }
    terraformId = `${terraformId}_${seq}`;
  }
  SPACE_TERRAFORM_IDS.add(terraformId);
  return terraformId;
}

const importSpaces = async function (): Promise<ResourceImport[]> {
  const response = await getRequest(
    `${API_URL_PREFIX}/spaces`, 
    false, 
    AUTHORIZATION_HEADER
  );
  const spaces: APISpace[] = response.data.data;
  return spaces
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((space) => ({ 
      id: space.id, 
      terraformId: generateTerraformIdForSpace(space.domain), 
      resourceType: "retool_space" 
    }));

  return [];
}

const importSourceControl = async function (): Promise<ResourceImport[]> {
  const response = await getRequest(
    `${API_URL_PREFIX}/source_control/config`, 
    false, 
    AUTHORIZATION_HEADER
  );
  if (!response) {
    return [];
  }

  return [{
    id: "source_control",
    terraformId: "source_control",
    resourceType: "retool_source_control"
  }];
}

const importSourceControlSettings = function (): ResourceImport[] {
  return [{
    id: "source_control_settings",
    terraformId: "source_control_settings",
    resourceType: "retool_source_control_settings"
  }];
}

const importSSO = async function (): Promise<ResourceImport[]> {
  const response = await getRequest(
    `${API_URL_PREFIX}/sso/config`, 
    false, 
    AUTHORIZATION_HEADER
  );
  if (!response) {
    return [];
  }

  return [{
    id: "sso",
    terraformId: "sso",
    resourceType: "retool_sso"
  }];
}

const handler = async function (argv: any) {
  // fire and forget
  void logDAU();

  if (!process.env.RETOOL_ACCESS_TOKEN || !process.env.RETOOL_HOST) {
    console.error("This command requires RETOOL_ACCESS_TOKEN and RETOOL_HOST environment variables to be set.");
    process.exit(1);
  }

  if (argv.imports) {
    const spinner = ora("Generating Terraform file with `import` blocks").start();

    const imports: ResourceImport[] = []
    imports.push(...(await importFolders()));
    const groupImports = await importGroups();
    imports.push(...groupImports);
    imports.push(...importPermissions(groupImports.map((group) => group.id)));
    imports.push(...(await importSpaces()));
    imports.push(...(await importSourceControl()));
    imports.push(...importSourceControlSettings());
    imports.push(...(await importSSO()));
  
    // Print everything into a file
    const fileContent = imports.map((im) => {
      return `
import {
  to = ${im.resourceType}.${im.terraformId}
  id = "${im.id}"
}
`
    }).join("");
    fs.writeFileSync(argv.imports, fileContent);
  
    spinner.stop();
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
