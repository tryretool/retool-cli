import { Credentials } from "./credentials";
import { getRequest } from "./networking";

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
