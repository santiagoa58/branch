import { stageSchemas, type AiStage, type StageInput, type StageOutput } from "@/schemas/aiDesign";
import type { ZodType } from "zod";
import { serializeJsonRequest } from "./jsonRequest";
import { readJsonResponse } from "./jsonResponse";
import { sendApiRequest } from "./transport";

// Pairs each stage with its contract. Indexing this mapped type by a generic stage keeps the
// correlation between the stage, its input and its output, so no type assertion is needed.
const stageContracts: {
  [S in AiStage]: { input: ZodType<StageInput<S>>; output: ZodType<StageOutput<S>> };
} = {
  requirements: stageSchemas.requirements,
  components: stageSchemas.components,
  decisions: stageSchemas.decisions,
  api: stageSchemas.api,
  "data-model": stageSchemas["data-model"],
};

export const aiApi = {
  run: async <S extends AiStage>(
    stage: S,
    input: StageInput<S>,
    signal: AbortSignal,
  ): Promise<StageOutput<S>> => {
    const path = `/ai/${stage}`;
    const contract = stageContracts[stage];
    const body = serializeJsonRequest("POST", path, contract.input, input);
    const response = await sendApiRequest("POST", path, { ...body, signal });
    return readJsonResponse("POST", path, response, contract.output);
  },
};
