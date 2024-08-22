import { getRequest } from "./networking";

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
const GROUP_TERRAFORM_IDS = new Set<string>();
const GROUP_ID_TO_TERRAFORM_ID = new Map<string, string>();
const SPACE_TERRAFORM_IDS = new Set<string>();

// This type represents any imported terraform resource
type TerraformResourceImport = {
  id: string; // The ID of the resource in the Retool database. Can be set to a dummy id for resoures that don't have an ID, like SSO settings.
  terraformId: string;
  resourceType: "retool_folder" | "retool_group" | "retool_permissions" | "retool_space" | "retool_source_control" | "retool_source_control_settings" | "retool_sso";
};

// Ensure that the generated Terraform id is unique - if not, append a sequence number to it
const makeUniqueTerraformId = (terraformId: string, existingIds: Set<string>): string => {
  if (existingIds.has(terraformId)) {
    let seq = 1;
    while (existingIds.has(`${terraformId}_${seq}`)) {
      seq++;
    }
    terraformId = `${terraformId}_${seq}`;
  }
  existingIds.add(terraformId);
  return terraformId;
}

// Ensure the terraformId starts with a letter or underscore. We also want to avoid single character terraformIds.
const isInvalidTerraformId = (terraformId: string): boolean => {
  return terraformId.length <= 1 || !/^[a-z_]/.test(terraformId);
}

const generateTerraformIdForFolder = (folderType: string, folderName: string): string => {
  let terraformId = sanitizeUnicodeName(folderName);
  if (isInvalidTerraformId(terraformId)) { 
    terraformId = `${folderType}_folder_${terraformId}`;
  }
  return makeUniqueTerraformId(terraformId, FOLDER_TERRAFORM_IDS);
}

type APIFolder = { 
  id: string
  name: string
  folder_type: string
  is_system_folder: boolean 
};

// Read non-system folders from the Retool API and generate Terraform ids for them
const importFolders = async function (): Promise<TerraformResourceImport[]> {
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

const generateTerraformIdForGroup = (groupName: string, groupId: string): string => {
  let terraformId = sanitizeUnicodeName(groupName);
  if (isInvalidTerraformId(terraformId)) { 
    terraformId = `group_${terraformId}`;
  }
  terraformId = makeUniqueTerraformId(terraformId, GROUP_TERRAFORM_IDS);
  GROUP_ID_TO_TERRAFORM_ID.set(groupId, terraformId);
  return terraformId;
}

const importGroups = async function (): Promise<TerraformResourceImport[]> {
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

const importPermissions = function (groupIds: string[]): TerraformResourceImport[] {
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

const generateTerraformIdForSpace = (spaceDomain: string): string => {
  // the unfortunate thing here is that users can put whatever they want in the domain field, so we have to guard against that
  let terraformId = spaceDomain
    .replace(/\./g, '_')
    .replace(/[^\w\s-]/g, '') // Remove non-alphanumeric characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .toLowerCase(); // Convert to lowercase

  if (isInvalidTerraformId(terraformId)) { 
    terraformId = `space_${terraformId}`;
  }
  return makeUniqueTerraformId(terraformId, SPACE_TERRAFORM_IDS);
}

const importSpaces = async function (): Promise<TerraformResourceImport[]> {
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

const importSourceControl = async function (): Promise<TerraformResourceImport[]> {
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

const importSourceControlSettings = function (): TerraformResourceImport[] {
  return [{
    id: "source_control_settings",
    terraformId: "source_control_settings",
    resourceType: "retool_source_control_settings"
  }];
}

const importSSO = async function (): Promise<TerraformResourceImport[]> {
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

export const importRetoolConfig = async function (): Promise<TerraformResourceImport[]> {
  const imports: TerraformResourceImport[] = []
  imports.push(...(await importFolders()));
  const groupImports = await importGroups();
  imports.push(...groupImports);
  imports.push(...importPermissions(groupImports.map((group) => group.id)));
  imports.push(...(await importSpaces()));
  imports.push(...(await importSourceControl()));
  imports.push(...importSourceControlSettings());
  imports.push(...(await importSSO()));
  return imports;
}
