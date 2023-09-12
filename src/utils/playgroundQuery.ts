import { Credentials } from "./credentials";
import { postRequest } from "./networking";

export type PlaygroundQuery = {
  id: number;
  uuid: string;
  name: string;
  description: string;
  shared: boolean;
  createdAt: string;
  updatedAt: string;
  organizationId: number;
  ownerId: number;
  saveId: number;
  template: Record<string, any>;
  resourceId: number;
  resourceUuid: string;
  adhocResourceType: string;
};

export async function createPlaygroundQuery(
  resourceId: number,
  credentials: Credentials,
  queryName?: string
): Promise<PlaygroundQuery> {
  const createPlaygroundQueryResult = await postRequest(
    `${credentials.origin}/api/playground`,
    {
      name: queryName || "CLI Generated RPC Query",
      description: "",
      shared: false,
      resourceId,
      data: {
        // Set default querytimeout to 10 seconds
        queryTimeout: "10000",
      },
    }
  );

  const { query } = createPlaygroundQueryResult.data;
  if (!query?.uuid) {
    console.log("Error creating playground query.");
    console.log(createPlaygroundQueryResult.data);
    process.exit(1);
  } else {
    return query;
  }
}
