import { stageContracts, type AiStage, type StageInput } from "../../../src/schemas/aiDesign";
import { buildApiPrompt } from "./api";
import { buildComponentsPrompt } from "./components";
import { buildDataModelPrompt } from "./dataModel";
import { buildDecisionsPrompt } from "./decisions";
import { buildRequirementsPrompt } from "./requirements";
import { joinSections, outputSchemaSection, type StagePrompt } from "./shared";

export type { StagePrompt } from "./shared";

// Ends every stage's system prompt with that stage's output JSON Schema, rendered once per stage.
function withOutputSchema<S extends AiStage>(
  stage: S,
  build: (input: StageInput<S>) => StagePrompt,
): (input: StageInput<S>) => StagePrompt {
  const schema = outputSchemaSection(stageContracts[stage].output);
  return (input) => {
    const { system, prompt } = build(input);
    return { system: joinSections(system, schema), prompt };
  };
}

export const stagePrompts: { [S in AiStage]: (input: StageInput<S>) => StagePrompt } = {
  requirements: withOutputSchema("requirements", buildRequirementsPrompt),
  components: withOutputSchema("components", buildComponentsPrompt),
  decisions: withOutputSchema("decisions", buildDecisionsPrompt),
  api: withOutputSchema("api", buildApiPrompt),
  "data-model": withOutputSchema("data-model", buildDataModelPrompt),
};
