import { Credentials } from "./credentials";
import { getRequest } from "./networking";

const example = {
  resourceByEnv: {
    staging: {
      displayName: "rpc external",
      databasePassword: null,
      options: {},
      id: 5,
      name: "67e75e5e-ab5d-4f2d-a7be-4106158c5611",
      type: "retoolSdk",
      environment: "staging",
      host: null,
      port: null,
      databaseName: null,
      databaseUsername: null,
      description: null,
      outboundRegion: null,
      ssl: null,
      editPrivilege: null,
      whitelabeled: null,
      dynamicallyQueryable: false,
      environmentId: "33d2e330-167a-4dd2-82cc-3bad38a83f21",
      protected: false,
      lastSyncedChecksum: null,
      authorId: null,
      uuid: "fad9472f-b1c1-46c2-a444-f6b739e27885",
      createdAt: "2023-08-24T18:12:14.796Z",
      updatedAt: "2023-08-24T18:12:14.796Z",
      organizationId: 1,
      resourceFolderId: 1,
      editorType: "RetoolSDKQuery",
      accessLevel: "own",
      gridManaged: false,
      synced: false,
      tokenData: {
        authFlowType: "UNKNOWN",
        tokens: {},
      },
    },
    production: {
      displayName: "rpc external",
      databasePassword: null,
      options: {},
      id: 4,
      name: "67e75e5e-ab5d-4f2d-a7be-4106158c5611",
      type: "retoolSdk",
      environment: "production",
      host: null,
      port: null,
      databaseName: null,
      databaseUsername: null,
      description: null,
      outboundRegion: null,
      ssl: null,
      editPrivilege: null,
      whitelabeled: null,
      dynamicallyQueryable: false,
      environmentId: "783675ad-a03e-4fce-8892-0fd8815f7cbc",
      protected: false,
      lastSyncedChecksum: null,
      authorId: 1,
      uuid: "aa750f8c-cb45-434f-8c2f-86f5d0047b4f",
      createdAt: "2023-08-21T20:01:55.314Z",
      updatedAt: "2023-08-24T18:12:14.801Z",
      organizationId: 1,
      resourceFolderId: 1,
      editorType: "RetoolSDKQuery",
      accessLevel: "own",
      gridManaged: false,
      synced: false,
      tokenData: {
        authFlowType: "UNKNOWN",
        tokens: {},
      },
    },
    "33d2e330-167a-4dd2-82cc-3bad38a83f21": {
      displayName: "rpc external",
      databasePassword: null,
      options: {},
      id: 5,
      name: "67e75e5e-ab5d-4f2d-a7be-4106158c5611",
      type: "retoolSdk",
      environment: "staging",
      host: null,
      port: null,
      databaseName: null,
      databaseUsername: null,
      description: null,
      outboundRegion: null,
      ssl: null,
      editPrivilege: null,
      whitelabeled: null,
      dynamicallyQueryable: false,
      environmentId: "33d2e330-167a-4dd2-82cc-3bad38a83f21",
      protected: false,
      lastSyncedChecksum: null,
      authorId: null,
      uuid: "fad9472f-b1c1-46c2-a444-f6b739e27885",
      createdAt: "2023-08-24T18:12:14.796Z",
      updatedAt: "2023-08-24T18:12:14.796Z",
      organizationId: 1,
      resourceFolderId: 1,
      editorType: "RetoolSDKQuery",
      accessLevel: "own",
      gridManaged: false,
      synced: false,
      tokenData: {
        authFlowType: "UNKNOWN",
        tokens: {},
      },
    },
    "783675ad-a03e-4fce-8892-0fd8815f7cbc": {
      displayName: "rpc external",
      databasePassword: null,
      options: {},
      id: 4,
      name: "67e75e5e-ab5d-4f2d-a7be-4106158c5611",
      type: "retoolSdk",
      environment: "production",
      host: null,
      port: null,
      databaseName: null,
      databaseUsername: null,
      description: null,
      outboundRegion: null,
      ssl: null,
      editPrivilege: null,
      whitelabeled: null,
      dynamicallyQueryable: false,
      environmentId: "783675ad-a03e-4fce-8892-0fd8815f7cbc",
      protected: false,
      lastSyncedChecksum: null,
      authorId: 1,
      uuid: "aa750f8c-cb45-434f-8c2f-86f5d0047b4f",
      createdAt: "2023-08-21T20:01:55.314Z",
      updatedAt: "2023-08-24T18:12:14.801Z",
      organizationId: 1,
      resourceFolderId: 1,
      editorType: "RetoolSDKQuery",
      accessLevel: "own",
      gridManaged: false,
      synced: false,
      tokenData: {
        authFlowType: "UNKNOWN",
        tokens: {},
      },
    },
  },
};

export type ResourceByEnv = Record<string, Resource>;

export type Resource = {
  displayName: string;
  id: number;
  name: string;
  type: string;
  environment: string;
  environmentId: string;
  uuid: string;
  organizationId: number;
  resourceFolderId: number;
};

export async function getResourceByName(
  resourceName: string,
  credentials: Credentials
): Promise<ResourceByEnv> {
  const getResourceResult = await getRequest(
    `${credentials.origin}/api/resources/names/${resourceName}`
  );

  const { resourceByEnv } = getResourceResult.data;
  if (!resourceByEnv) {
    console.log("Error finding resource by that id.");
    console.log(getResourceResult.data);
    process.exit(1);
  } else {
    return resourceByEnv;
  }
}
