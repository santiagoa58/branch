import type { ComponentsInput } from "../../../src/schemas/aiDesign";
import {
  architectureNodeTypeSchema,
  edgeProtocolSchema,
  groupNodeTypeSchema,
} from "../../../src/schemas/catalogEnums";
import { urlShortenerExample } from "../examples/urlShortener";
import {
  example,
  formatContext,
  joinSections,
  section,
  DESIGN_PREAMBLE,
  type StagePrompt,
} from "./shared";

function previousKeysSection(previousKeys: string[]): string {
  return section("Previous component keys:", previousKeys);
}

const SYSTEM = joinSections(
  DESIGN_PREAMBLE,
  `Your task: choose the components of the system and how they connect.
- summary: two or three sentences on how the design works.
- components: one per box on the diagram, each with a one-line responsibility. Put a component in a group only when the boundary matters.
- groups: optional boundaries such as a VPC or region. A group's parent is another group key.
- connections: who calls whom, with the protocol, a short purpose, and async true for fire-and-forget messaging.
- mainFlow: the most important request path, starting at the component key in "entry".`,
  `Rules:
- Use only the types and protocols listed below.
- Keys are lowercase slugs (a-z, 0-9, hyphens), unique across groups and components. Connections, groups and mainFlow refer to these keys.
- Reuse a previous key for a component that still serves the same role, even if its label or type changes. Use new keys only for new roles.`,
  `Component types: ${architectureNodeTypeSchema.options.join(", ")}`,
  `Group types: ${groupNodeTypeSchema.options.join(", ")}`,
  `Protocols: ${edgeProtocolSchema.options.join(", ")}`,
  example(
    joinSections(formatContext(urlShortenerExample.context), previousKeysSection([])),
    urlShortenerExample.components,
  ),
);

export function buildComponentsPrompt(input: ComponentsInput): StagePrompt {
  return {
    system: SYSTEM,
    prompt: joinSections(formatContext(input.context), previousKeysSection(input.previousKeys)),
  };
}
