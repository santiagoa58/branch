import { createGatewayRunner } from "../server/ai/runner";
import { authenticate } from "../server/auth";
import { database } from "../server/db";
import { createHandler } from "../server/handler";
import { WorkspaceRepository } from "../server/repository";

export default {
  fetch: createHandler({
    authenticate,
    repository: new WorkspaceRepository(database),
    ai: createGatewayRunner(),
  }),
};
