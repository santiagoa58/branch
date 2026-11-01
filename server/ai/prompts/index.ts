import type { AiStage, StageInput } from "../../../src/schemas/aiDesign";
import { buildApiPrompt } from "./api";
import { buildComponentsPrompt } from "./components";
import { buildDataModelPrompt } from "./dataModel";
import { buildDecisionsPrompt } from "./decisions";
import { buildRequirementsPrompt } from "./requirements";
import type { StagePrompt } from "./shared";

export type { StagePrompt } from "./shared";

export const stagePrompts: { [S in AiStage]: (input: StageInput<S>) => StagePrompt } = {
  requirements: buildRequirementsPrompt,
  components: buildComponentsPrompt,
  decisions: buildDecisionsPrompt,
  api: buildApiPrompt,
  "data-model": buildDataModelPrompt,
};
