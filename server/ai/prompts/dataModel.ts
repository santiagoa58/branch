import type { DataModelInput } from "../../../src/schemas/aiDesign";
import {
  formatContext,
  formatGraph,
  joinSections,
  section,
  DESIGN_PREAMBLE,
  type StagePrompt,
} from "./shared";

const SYSTEM = joinSections(
  DESIGN_PREAMBLE,
  `Your task: design the data model behind the API.
- entities: the records the system stores, with their fields and relations.`,
  `Rules:
- Each entity's "store" is the key of the component that owns it, such as a database or cache.
- Fields have a name and a type. Mark the primary key, foreign keys and indexed fields with "key".
- Relations name another entity and the kind of relation.
- Model only what the endpoints and requirements need.`,
);

export function buildDataModelPrompt(input: DataModelInput): StagePrompt {
  return {
    system: SYSTEM,
    prompt: joinSections(
      formatContext(input.context),
      formatGraph(input.graph),
      section(
        "Endpoints (service: method path):",
        input.endpoints.map(({ service, method, path }) => `${service}: ${method} ${path}`),
      ),
    ),
  };
}
