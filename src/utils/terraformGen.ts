import { getRequest, postRequest } from "./networking";

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
} & ({
  resourceType: "retool_space" | "retool_source_control" | "retool_source_control_settings" | "retool_sso";
} | 
{ 
  resourceType: "retool_folder";
  folder: APIFolder;
} | {
  resourceType: "retool_group";
  group: APIGroup;
} | {
  resourceType: "retool_permissions";
  groupId: string;
});

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
  parent_folder_id: string
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
      resourceType: "retool_folder",
      folder
    }));
}

type APIGroup = {
  id: number
  name: string
  universal_app_access: string
  universal_resource_access: string
  universal_workflow_access: string
  universal_query_library_access: string
  user_list_access: boolean
  audit_log_access: boolean
  unpublished_release_access: boolean
  usage_analytics_access: boolean
  account_details_access: boolean
  landing_page_app_id: string
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
      resourceType: "retool_group",
      group
    }));
}

const importPermissions = function (groupIds: string[]): TerraformResourceImport[] {
  // We'll just generate imports based on the groups we fetched earlier
  return groupIds
    .map((groupId) => ({ 
      id: `group|${groupId}`, 
      terraformId: `${GROUP_ID_TO_TERRAFORM_ID.get(groupId)}_permissions`, 
      resourceType: "retool_permissions",
      groupId
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

const getRootFolderIds = async function (): Promise<Map<string, string>> {
  const response = await getRequest(
    `${API_URL_PREFIX}/folders`, 
    false, 
    AUTHORIZATION_HEADER
  );
  const folders: APIFolder[] = response.data.data;
  const rootFolderIdByType = new Map<string, string>();
  for (const folder of folders) {
    if (!folder.parent_folder_id) {
      rootFolderIdByType.set(folder.folder_type, folder.id);
    }
  }
  return rootFolderIdByType;
}

export const generateTerraformConfigForFolders = async function (folders: { id: string, terraformId: string, resourceType: "retool_folder", folder: APIFolder}[]): Promise<string[]> {
  const folderIdToTerraformId = new Map<string, string>();
  for (const folder of folders) {
    // technically, we could've used the folder.id directly, since it includes folder type, but I don't want to depend on this
    folderIdToTerraformId.set(`${folder.folder.folder_type}_${folder.id}`, folder.terraformId);
  }

  const rootFolderIdByType = await getRootFolderIds();
  let lines: string[] = [];
  for (const folder of folders) {
    const resourceConfigLines = [
      `resource "retool_folder" "${folder.terraformId}" {`,
      `  name = "${folder.folder.name}"`,
      `  folder_type = "${folder.folder.folder_type}"`,
    ];
    if (folder.folder.parent_folder_id) {
      if (folder.folder.parent_folder_id !== rootFolderIdByType.get(folder.folder.folder_type)) {
        const parentFolderTerraformId = folderIdToTerraformId.get(`${folder.folder.folder_type}_${folder.folder.parent_folder_id}`);
        resourceConfigLines.push(`  parent_folder_id = retool_folder.${parentFolderTerraformId}.id`);
      }
    }
    resourceConfigLines.push("}");
    resourceConfigLines.push("");
    lines = lines.concat(resourceConfigLines);
  }
  return lines;
}

type APIPermissions = {
  type: string
  id: string
  access_level: string
};

const getPermissionsForGroup = async function (groupId: string): Promise<APIPermissions[]> {
  let permissions: APIPermissions[] = [];
  for (const objectType of ["app", "folder", "resource", "resource_configuration"]){
    const response = await postRequest(
      `${API_URL_PREFIX}/permissions/listObjects`, 
      { 
        subject: {
          type: "group",
          id: parseInt(groupId),  
        },
        object_type: objectType,
      },
      false, 
      AUTHORIZATION_HEADER
    );
    if (!response || !response.data) {
      console.error(`Failed to fetch permissions for group ${groupId}, object type ${objectType}`);
    } else {
      permissions = permissions.concat(response.data.data);  
    }
  }
  return permissions;
}

export const generateTerraformConfigForGroups = function (groups: { id: string, terraformId: string, resourceType: "retool_group", group: APIGroup}[]): string[] {
  let lines: string[] = [];
  for (const group of groups) {
    const resourceConfigLines = [
      `resource "retool_group" "${group.terraformId}" {`,
      `  name = "${group.group.name}"`,
      `  universal_app_access = "${group.group.universal_app_access}"`,
      `  universal_resource_access = "${group.group.universal_resource_access}"`,
      `  universal_workflow_access = "${group.group.universal_workflow_access}"`,
      `  universal_query_library_access = "${group.group.universal_query_library_access}"`,
      `  user_list_access = ${group.group.user_list_access}`,
      `  audit_log_access = ${group.group.audit_log_access}`,
      `  unpublished_release_access = ${group.group.unpublished_release_access}`,
      `  usage_analytics_access = ${group.group.usage_analytics_access}`,
      `  account_details_access = ${group.group.account_details_access}`,
    ];
    if (group.group.landing_page_app_id) {
      resourceConfigLines.push(`  landing_page_app_id = "${group.group.landing_page_app_id}"`);
    }
    resourceConfigLines.push("}");
    resourceConfigLines.push("");
    lines = lines.concat(resourceConfigLines);
  }
  return lines;
}

export const generateTerraformConfigForPermissions = async function (permissions: { id: string, terraformId: string, resourceType: "retool_permissions", groupId: string}[], allResources: TerraformResourceImport[]): Promise<string[]> {
  const folderIdToTerraformId = new Map<string, string>();
  const groupIdToTerraformId = new Map<string, string>();
  for (const resource of allResources) {
    if (resource.resourceType === "retool_folder") {
      folderIdToTerraformId.set(resource.id, resource.terraformId);
    } else if (resource.resourceType === "retool_group") {
      groupIdToTerraformId.set(resource.id, resource.terraformId);
    }
  }
  let lines: string[] = [];
  for (const permission of permissions) {
    const groupPermissions = await getPermissionsForGroup(permission.groupId);
    const resourceConfigLines = [
      `resource "retool_permissions" "${permission.terraformId}" {`,
      `  subject = {`,
      `    type = "group"`,
      `    id = retool_group.${groupIdToTerraformId.get(permission.groupId)}.id`,
      `  }`,
      `  permissions = [`,
    ];
    for (const groupPermission of groupPermissions) {
      console.log(groupPermission);
      resourceConfigLines.push(`    {`);
      resourceConfigLines.push(`      object = {`);
      if (groupPermission.type === "folder" && folderIdToTerraformId.has(groupPermission.id)) {
        resourceConfigLines.push(`        type = "folder"`);
        resourceConfigLines.push(`        id = retool_folder.${folderIdToTerraformId.get(groupPermission.id)}.id`);
      } else {
        resourceConfigLines.push(`        type = "${groupPermission.type}"`);
        resourceConfigLines.push(`        id = "${groupPermission.id}"`);
      }
      resourceConfigLines.push(`      }`);
      resourceConfigLines.push(`      access_level = "${groupPermission.access_level}"`);
      resourceConfigLines.push(`    },`);
    }
    resourceConfigLines.push("  ]");
    resourceConfigLines.push("}");
    resourceConfigLines.push("");
    lines = lines.concat(resourceConfigLines);
  }
  return lines;
}
