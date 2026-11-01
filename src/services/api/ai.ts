import {
  stageContracts,
  type AiStage,
  type StageInput,
  type StageOutput,
} from "@/schemas/aiDesign";
import { serializeJsonRequest } from "./jsonRequest";
import { readJsonResponse } from "./jsonResponse";
import { sendApiRequest } from "./transport";

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
