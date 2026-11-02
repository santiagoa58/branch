import type { ApiInput } from "../../../src/schemas/aiDesign";
import { urlShortenerExample } from "../examples/urlShortener";
import {
  example,
  formatContext,
  formatGraph,
  joinSections,
  DESIGN_PREAMBLE,
  type StagePrompt,
} from "./shared";

const SYSTEM = joinSections(
  DESIGN_PREAMBLE,
  `Your task: design the API between the components.
- endpoints: the requests the system must serve to meet the requirements.
- events: the messages sent over async connections, with the component that produces them and those that consume them.`,
  `Rules:
- Each endpoint is owned by one component: "service" is the key of the component that serves it.
- "calledBy" lists the keys of the components that call it. Name the original callers, not gateways or proxies in between.
- Request, response and payload field maps are name → type, such as {"url": "string", "alias": "string?"}. A trailing ? marks an optional field.
- Only endpoints the requirements need; list the errors a caller must handle.
- Use style "stream" for streamed responses and "realtime" for long-lived connections such as WebSockets.`,
  example(
    joinSections(
      formatContext(urlShortenerExample.context),
      `Design summary: ${urlShortenerExample.components.summary}`,
      formatGraph({
        nodes: urlShortenerExample.components.components,
        edges: urlShortenerExample.components.connections,
      }),
    ),
    urlShortenerExample.api,
  ),
);

export function buildApiPrompt(input: ApiInput): StagePrompt {
  return {
    system: SYSTEM,
    prompt: joinSections(
      formatContext(input.context),
      `Design summary: ${input.summary}`,
      formatGraph(input.graph),
    ),
  };
}
