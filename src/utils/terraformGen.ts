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

type TerraformResourceImportBase = {
  id: string; // The ID of the resource in the Retool database. Can be set to a dummy id for resoures that don't have an ID, like SSO settings.
  terraformId: string;
}

export type TerraformFolderImport = TerraformResourceImportBase & {
  resourceType: "retool_folder";
  folder: APIFolder;
}

export type TerraformGroupImport = TerraformResourceImportBase & {
  resourceType: "retool_group";
  group: APIGroup;
}

export type TerraformPermissionsImport = TerraformResourceImportBase & {
  resourceType: "retool_permissions";
  groupId: string;
}

export type TerraformSSOImport = TerraformResourceImportBase & {
  resourceType: "retool_sso";
  ssoConfig: APISSOConfig;
}

export type TerraformSourceControlImport = TerraformResourceImportBase & {
  resourceType: "retool_source_control";
  sourceControlConfig: APISourceControlConfig;
}

export type TerraformSourceControlSettingsImport = TerraformResourceImportBase & {
  resourceType: "retool_source_control_settings";
  settings: APISourceControlSettings;
}

export type TerraformSpaceImport = TerraformResourceImportBase & {
  resourceType: "retool_space";
  space: APISpace;
}

// This type represents any imported terraform resource
type TerraformResourceImport = 
| TerraformFolderImport
| TerraformGroupImport
| TerraformPermissionsImport
| TerraformSSOImport
| TerraformSourceControlImport
| TerraformSourceControlSettingsImport
| TerraformSpaceImport;

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
      resourceType: "retool_space",
      space
    }));

  return [];
}

// Types below are generated based on the zod schema defined here: https://github.com/tryretool/retool_development/blob/c49c49d4bbab4972f7bf28e6348ec97dd2ff5b38/backend/src/server/publicApi/v2/sourceControl/schemas.ts#L161
type CommonGitHubConfig = {
  url?: string;
  enterprise_api_url?: string;
};

type GitHubAppConfig = CommonGitHubConfig & {
  type: 'App';
  app_id: string;
  installation_id: string;
  private_key: string;
};

type GitHubPersonalConfig = CommonGitHubConfig & {
  type: 'Personal';
  personal_access_token: string;
};

type GitHubConfig = GitHubAppConfig | GitHubPersonalConfig;

type GitLabConfig = {
  project_id: number;
  url: string;
  project_access_token: string;
};

type AWSCodeCommitConfig = {
  url: string;
  region: string;
  access_key_id: string;
  secret_access_key: string;
  https_username: string;
  https_password: string;
};

type BitbucketConfig = {
  username: string;
  url?: string;
  enterprise_api_url?: string;
  app_password: string;
};

type AzureReposConfig = {
  url: string;
  project: string;
  user: string;
  personal_access_token: string;
  use_basic_auth: boolean;
};

type SourceControlBaseConfigurationExternal = {
  provider: string;
  org: string;
  repo: string;
  default_branch: string;
  repo_version?: string;
};

type APISourceControlConfig =
  | (SourceControlBaseConfigurationExternal & {
      config: GitHubConfig;
      provider: 'GitHub';
    })
  | (SourceControlBaseConfigurationExternal & {
      config: GitLabConfig;
      provider: 'GitLab';
    })
  | (SourceControlBaseConfigurationExternal & {
      config: AWSCodeCommitConfig;
      provider: 'AWS CodeCommit';
    })
  | (SourceControlBaseConfigurationExternal & {
      config: BitbucketConfig;
      provider: 'Bitbucket';
    })
  | (SourceControlBaseConfigurationExternal & {
      config: AzureReposConfig;
      provider: 'Azure Repos';
    });

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
    resourceType: "retool_source_control",
    sourceControlConfig: response.data.data,
  }];
}

type APISourceControlSettings = {
  auto_branch_naming_enabled: boolean;
  custom_pull_request_template_enabled: boolean;
  custom_pull_request_template: string;
  version_control_locked: boolean;
}

const importSourceControlSettings = async function (): Promise<TerraformResourceImport[]> {
  const response = await getRequest(
    `${API_URL_PREFIX}/source_control/settings`, 
    false, 
    AUTHORIZATION_HEADER
  );
  if (!response) {
    return [];
  }

  return [{
    id: "source_control_settings",
    terraformId: "source_control_settings",
    resourceType: "retool_source_control_settings",
    settings: response.data.data,
  }];
}

// Based on the API schema here: https://github.com/tryretool/retool_development/blob/e3637e2a7471a3875a6c36b496a175c5925540f3/backend/src/server/publicApi/v2/sso/schemas.ts#L192
type APISSOConfig =
| {
    config_type: 'google'
    google_client_id: string
    google_client_secret: string
    disable_email_password_login: boolean
    jit_enabled: boolean
    restricted_domain?: string
    trigger_login_automatically: boolean
  }
| {
    config_type: 'oidc'
    oidc_client_id: string
    oidc_client_secret: string
    oidc_scopes: string
    oidc_auth_url: string
    oidc_token_url: string
    oidc_userinfo_url?: string
    oidc_audience?: string
    jwt_email_key: string
    jwt_roles_key?: string
    jwt_first_name_key: string
    jwt_last_name_key: string
    roles_mapping?: string
    jit_enabled: boolean
    restricted_domain?: string
    trigger_login_automatically: boolean
    disable_email_password_login: boolean
  }
| {
    config_type: 'google & oidc'
    google_client_id: string
    google_client_secret: string
    disable_email_password_login: boolean
    oidc_client_id: string
    oidc_client_secret: string
    oidc_scopes: string
    oidc_auth_url: string
    oidc_token_url: string
    oidc_userinfo_url?: string
    oidc_audience?: string
    jwt_email_key: string
    jwt_roles_key?: string
    jwt_first_name_key: string
    jwt_last_name_key: string
    roles_mapping?: string
    jit_enabled: boolean
    restricted_domain?: string
    trigger_login_automatically: boolean
  }
| {
    config_type: 'saml'
    idp_metadata_xml: string
    saml_first_name_attribute: string
    saml_last_name_attribute: string
    saml_groups_attribute?: string
    saml_sync_group_claims: boolean
    ldap_sync_group_claims?: boolean
    ldap_role_mapping?: string
    ldap_server_url?: string
    ldap_base_domain_components?: string
    ldap_server_name?: string
    ldap_server_key?: string
    ldap_server_certificate?: string
    jit_enabled: boolean
    restricted_domain?: string
    trigger_login_automatically: boolean
    disable_email_password_login: boolean
  }
| {
    config_type: 'google & saml'
    google_client_id: string
    google_client_secret: string
    disable_email_password_login: boolean
    idp_metadata_xml: string
    saml_first_name_attribute: string
    saml_last_name_attribute: string
    saml_groups_attribute?: string
    saml_sync_group_claims: boolean
    ldap_sync_group_claims?: boolean
    ldap_role_mapping?: string
    ldap_server_url?: string
    ldap_base_domain_components?: string
    ldap_server_name?: string
    ldap_server_key?: string
    ldap_server_certificate?: string
    jit_enabled: boolean
    restricted_domain?: string
    trigger_login_automatically: boolean
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
    resourceType: "retool_sso",
    ssoConfig: response.data.data,
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
  imports.push(...(await importSourceControlSettings()));
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

export const generateTerraformConfigForFolders = async function (folders: TerraformFolderImport[]): Promise<string[]> {
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

export const generateTerraformConfigForGroups = function (groups: TerraformGroupImport[]): string[] {
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

export const generateTerraformConfigForPermissions = async function (permissions: TerraformPermissionsImport[], allResources: TerraformResourceImport[]): Promise<string[]> {
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

// Parses a string like "key1->value1,key2->value2" into a map. 
// Copied from https://github.com/tryretool/retool_development/blob/76da02b9538884f27bc4499e742099163a6d3841/packages/common/utils/parseArrowSyntax.ts
const parseArrowSyntax = function (arrowSyntax: string | unknown): { [key: string]: string } {
  if (typeof arrowSyntax !== 'string') {
    return {}
  }
  return arrowSyntax.split(',').reduce((acc: Record<string, string>, arrowSyntaxSubstring) => {
    const splitted = arrowSyntaxSubstring.split('->')
    if (!splitted || !splitted[0] || !splitted[1]) {
      return acc
    }
    const key = splitted[0].trim()
    const value = splitted[1].trim()
    acc[key] = value
    return acc
  }, {})
}

// Parses a string like "key1->value, key2-> value, key1->value2" into a map of string arrays. 
// input "b -> B, b -> C" will result in output {b: ["B", "C"]}
// Copied from https://github.com/tryretool/retool_development/blob/76da02b9538884f27bc4499e742099163a6d3841/packages/common/utils/parseArrowSyntaxMultiValue.ts#L2-L3
const parseArrowSyntaxMultiValue = function (arrowSyntax: string | unknown): { [key: string]: string[] } {
  const result: { [key: string]: string[] } = {}
  if (typeof arrowSyntax !== 'string') {
    return result
  }
  arrowSyntax.split(',').forEach((arrowSyntaxSubstring) => {
    const splits = arrowSyntaxSubstring.split('->')
    if (splits.length !== 2) return
    const [key, value] = [splits[0].trim(), splits[1].trim()]
    if (!key || !value) return
    if (!(key in result)) {
      result[key] = []
    }
    // check for dup and push
    if (!result[key].includes(value)) {
      result[key].push(value)
    }
  })
  return result
}


export const generateTerraformConfigForSSO = function (sso: TerraformSSOImport): string[] {
  const lines = [
    `resource "retool_sso" "${sso.terraformId}" {`,
  ];
  if (sso.ssoConfig.config_type === "google" || sso.ssoConfig.config_type === "google & oidc" || sso.ssoConfig.config_type === "google & saml") {
    lines.push(`  google = {`);
    lines.push(`    client_id = "${sso.ssoConfig.google_client_id}"`);
    lines.push(`    client_secret = null # Replace with your client secret`);
    lines.push(`  }`);
  }
  if (sso.ssoConfig.config_type === "oidc" || sso.ssoConfig.config_type === "google & oidc") {
    lines.push(`  oidc = {`);
    lines.push(`    client_id = "${sso.ssoConfig.oidc_client_id}"`);
    lines.push(`    client_secret = null # Replace with your client secret`);
    lines.push(`    scopes = "${sso.ssoConfig.oidc_scopes}"`);
    lines.push(`    auth_url = "${sso.ssoConfig.oidc_auth_url}"`);
    lines.push(`    token_url = "${sso.ssoConfig.oidc_token_url}"`);
    if (sso.ssoConfig.oidc_userinfo_url) {
      lines.push(`    userinfo_url = "${sso.ssoConfig.oidc_userinfo_url}"`);
    }
    if (sso.ssoConfig.oidc_audience) {
      lines.push(`    audience = "${sso.ssoConfig.oidc_audience}"`);
    }
    lines.push(`    jwt_email_key = "${sso.ssoConfig.jwt_email_key}"`);
    if (sso.ssoConfig.jwt_roles_key) {
      lines.push(`    jwt_roles_key = "${sso.ssoConfig.jwt_roles_key}"`);
    }
    lines.push(`    jwt_first_name_key = "${sso.ssoConfig.jwt_first_name_key}"`);
    lines.push(`    jwt_last_name_key = "${sso.ssoConfig.jwt_last_name_key}"`);
    if (sso.ssoConfig.roles_mapping) {
      // parse -> syntax into string-string map
      const rolesMapping = parseArrowSyntax(sso.ssoConfig.roles_mapping);
      lines.push(`    roles_mapping = {`);
      for (const [key, value] of Object.entries(rolesMapping)) {
        lines.push(`      ${key} = "${value}"`);
      }
      lines.push(`    }`);
    }
    lines.push(`    jit_enabled = ${sso.ssoConfig.jit_enabled}`);
    lines.push(`    trigger_login_automatically = ${sso.ssoConfig.trigger_login_automatically}`);
    if (sso.ssoConfig.restricted_domain) {
      lines.push(`    restricted_domains = [${sso.ssoConfig.restricted_domain.split(',').map((domain) => `"${domain.trim()}"`).join(", ")}]`);
    }
    lines.push(`  }`);
  }
  if (sso.ssoConfig.config_type === "saml" || sso.ssoConfig.config_type === "google & saml") {
    lines.push(`  saml = {`);
    lines.push(`    idp_metadata_xml = "${sso.ssoConfig.idp_metadata_xml}"`);
    lines.push(`    first_name_attribute = "${sso.ssoConfig.saml_first_name_attribute}"`);
    lines.push(`    last_name_attribute = "${sso.ssoConfig.saml_last_name_attribute}"`);
    if (sso.ssoConfig.saml_groups_attribute) {
      lines.push(`    groups_attribute = "${sso.ssoConfig.saml_groups_attribute}"`);
    }
    lines.push(`    sync_group_claims = ${sso.ssoConfig.saml_sync_group_claims}`);
    if (sso.ssoConfig.ldap_role_mapping) {
      const rolesMapping = parseArrowSyntaxMultiValue(sso.ssoConfig.ldap_role_mapping);
      lines.push(`    roles_mapping = {`);
      for (const [key, value] of Object.entries(rolesMapping)) {
        lines.push(`      ${key} = [${value.map((v) => `"${v}"`).join(", ")}]`);
      }
      lines.push(`    }`);
    }
    lines.push(`    ldap_sync_group_claims = ${sso.ssoConfig.ldap_sync_group_claims}`);
    if (sso.ssoConfig.ldap_server_url || sso.ssoConfig.ldap_base_domain_components || sso.ssoConfig.ldap_server_name || sso.ssoConfig.ldap_server_key || sso.ssoConfig.ldap_server_certificate) {
      lines.push(`    ldap = {`);
      if (sso.ssoConfig.ldap_server_url) {
        lines.push(`      server_url = "${sso.ssoConfig.ldap_server_url}"`);
      }
      if (sso.ssoConfig.ldap_base_domain_components) {
        lines.push(`      base_domain_components = "${sso.ssoConfig.ldap_base_domain_components}"`);
      }
      if (sso.ssoConfig.ldap_server_name) {
        lines.push(`      server_name = "${sso.ssoConfig.ldap_server_name}"`);
      }
      if (sso.ssoConfig.ldap_server_key) {
        lines.push(`      server_key = null # Replace with your server key`);
      }
      if (sso.ssoConfig.ldap_server_certificate) {
        lines.push(`      server_certificate = null # Replace with your server certificate`);
      }
      lines.push(`    }`);
    }
    lines.push(`    jit_enabled = ${sso.ssoConfig.jit_enabled}`);
    lines.push(`    trigger_login_automatically = ${sso.ssoConfig.trigger_login_automatically}`);
    if (sso.ssoConfig.restricted_domain) {
      lines.push(`    restricted_domains = [${sso.ssoConfig.restricted_domain.split(',').map((domain) => `"${domain.trim()}"`).join(", ")}]`);
    }
    lines.push(`  }`);
  }
  lines.push(`  disable_email_password_login = ${sso.ssoConfig.disable_email_password_login}`);
  lines.push("}");
  lines.push("");
  return lines;
}

export const generateTerraformConfigForSourceControl = function (sourceControl: TerraformSourceControlImport): string[] {
  const lines = [
    `resource "retool_source_control" "${sourceControl.terraformId}" {`,
  ];
  lines.push(`  org = "${sourceControl.sourceControlConfig.org}"`);
  lines.push(`  repo = "${sourceControl.sourceControlConfig.repo}"`);
  lines.push(`  default_branch = "${sourceControl.sourceControlConfig.default_branch}"`);
  if (sourceControl.sourceControlConfig.repo_version) {
    lines.push(`  repo_version = "${sourceControl.sourceControlConfig.repo_version}"`);
  }
  if (sourceControl.sourceControlConfig.provider === "GitHub") {
    lines.push(`  github = {`);
    const config = sourceControl.sourceControlConfig.config;
    if (config.type === "App") {
      lines.push(`    app_authentication = {`);
      lines.push(`      app_id = "${config.app_id}"`);
      lines.push(`      installation_id = "${config.installation_id}"`);
      lines.push(`      private_key = null # Replace with your private key`);
      lines.push(`    }`);
    } else {
      lines.push(`    personal_access_token = null # Replace with your personal access token`);
    }
    if (config.url) {
      lines.push(`    url = "${config.url}"`);
    }
    if (config.enterprise_api_url) {
      lines.push(`    enterprise_api_url = "${config.enterprise_api_url}"`);
    }
    lines.push("  }");
  } else if (sourceControl.sourceControlConfig.provider === "GitLab") {
    lines.push(`  gitlab = {`);
    const config = sourceControl.sourceControlConfig.config;
    lines.push(`    project_id = ${config.project_id}`);
    lines.push(`    project_access_token = null # Replace with your project access token`);
    lines.push(`    url = "${config.url}"`);
    lines.push("  }");
  } else if (sourceControl.sourceControlConfig.provider === "AWS CodeCommit") {
    lines.push(`  aws_codecommit = {`);
    const config = sourceControl.sourceControlConfig.config;
    lines.push(`    region = "${config.region}"`);
    lines.push(`    access_key_id = null # Replace with your access key id`);
    lines.push(`    secret_access_key = null # Replace with your secret access key`);
    lines.push(`    https_username = "${config.https_username}"`);
    lines.push(`    https_password = null # Replace with your https password`);
    lines.push(`    url = "${config.url}"`);
    lines.push("  }");
  } else if (sourceControl.sourceControlConfig.provider === "Bitbucket") {
    lines.push(`  bitbucket = {`);
    const config = sourceControl.sourceControlConfig.config;
    lines.push(`    username = "${config.username}"`);
    lines.push(`    app_password = null # Replace with your app password`);
    lines.push(`    url = "${config.url}"`);
    lines.push(`    enterprise_api_url = "${config.enterprise_api_url}"`);
    lines.push("  }");
  } else if (sourceControl.sourceControlConfig.provider === "Azure Repos") {
    lines.push(`  azure_repos = {`);
    const config = sourceControl.sourceControlConfig.config;
    lines.push(`    project = "${config.project}"`);
    lines.push(`    user = "${config.user}"`);
    lines.push(`    personal_access_token = null # Replace with your personal access token`);
    lines.push(`    use_basic_auth = ${config.use_basic_auth}`);
    lines.push(`    url = "${config.url}"`);
    lines.push("  }");
  }
  lines.push("}");
  lines.push("");
  return lines;
}

export const generateTerraformConfigForSourceControlSettings = function (settings: TerraformSourceControlSettingsImport): string[] {
  const lines = [
    `resource "retool_source_control_settings" "${settings.terraformId}" {`,
  ];
  lines.push(`  auto_branch_naming_enabled = ${settings.settings.auto_branch_naming_enabled}`);
  lines.push(`  custom_pull_request_template_enabled = ${settings.settings.custom_pull_request_template_enabled}`);
  if (settings.settings.custom_pull_request_template) {
    lines.push(`  custom_pull_request_template = "${settings.settings.custom_pull_request_template}"`);
  }
  lines.push(`  version_control_locked = ${settings.settings.version_control_locked}`);
  lines.push("}");
  lines.push("");
  return lines;
}

export const generateTerraformConfigForSpaces = function (spaces: TerraformSpaceImport[]): string[] {
  const lines: string[] = []
  for (const spaceResource of spaces) {
    lines.push(`resource "retool_space" "${spaceResource.terraformId}" {`);
    lines.push(`  name = "${spaceResource.space.name}"`);
    lines.push(`  domain = "${spaceResource.space.domain}"`);
    lines.push("}");
    lines.push("");
  }
  return lines;
}
