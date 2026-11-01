// @vitest-environment node
import { describe, it, expect } from "vite-plus/test";
import { DIAGRAM_TEMPLATES } from "@/templates";
import { architectureEdgeDataSchema, designDecisionSchema } from "@/schemas/diagram";
import {
  apiOutputSchema,
  componentsOutputSchema,
  decisionsOutputSchema,
  designContextSchema,
} from "../../src/schemas/aiDesign";
import { urlShortenerExample } from "./examples/urlShortener";

// The example is a hand-written copy of the url-shortener template, kept small for the prompts.
// These tests fail when the template changes so the few-shot examples never drift from it.
const template = DIAGRAM_TEMPLATES.find((candidate) => candidate.id === "url-shortener");
if (!template) {
  throw new Error("The url-shortener template is missing");
}
const { nodes, edges, flows } = template.data;
const byKey = <T extends { key: string }>(a: T, b: T) => a.key.localeCompare(b.key);
const byEdge = <T extends { from: string; to: string }>(a: T, b: T) =>
  `${a.from}>${a.to}`.localeCompare(`${b.from}>${b.to}`);

describe("urlShortenerExample", () => {
  it("is valid stage output", () => {
    expect(() => designContextSchema.parse(urlShortenerExample.context)).not.toThrow();
    expect(() => componentsOutputSchema.parse(urlShortenerExample.components)).not.toThrow();
    expect(() => decisionsOutputSchema.parse(urlShortenerExample.decision.output)).not.toThrow();
    expect(() => apiOutputSchema.parse(urlShortenerExample.api)).not.toThrow();
  });

  it("has the template's components", () => {
    const fromTemplate = nodes
      .map((node) => ({ key: node.id, type: node.data["type"], label: node.data["label"] }))
      .sort(byKey);
    const fromExample = urlShortenerExample.components.components
      .map(({ key, type, label }) => ({ key, type, label }))
      .sort(byKey);
    expect(fromExample).toEqual(fromTemplate);
    expect(urlShortenerExample.components.groups).toEqual([]);
  });

  it("has the template's connections", () => {
    const fromTemplate = edges
      .map((edge) => {
        const data = architectureEdgeDataSchema.parse(edge.data);
        return {
          from: edge.source,
          to: edge.target,
          protocol: data.protocol,
          async: data.async ?? false,
        };
      })
      .sort(byEdge);
    const fromExample = urlShortenerExample.components.connections
      .map(({ from, to, protocol, async }) => ({ from, to, protocol, async }))
      .sort(byEdge);
    expect(fromExample).toEqual(fromTemplate);
  });

  it("has the template's main flow", () => {
    const flow = flows?.[0];
    expect(urlShortenerExample.components.mainFlow).toEqual({
      name: flow?.name,
      description: flow?.description,
      entry: flow?.sourceNodeId,
    });
  });

  it("has the template's decision for the example node", () => {
    const { key, output } = urlShortenerExample.decision;
    const node = nodes.find((candidate) => candidate.id === key);
    const decision = designDecisionSchema.parse(node?.data["decision"]);
    expect(output).toEqual({
      choice: decision.choice,
      reason: decision.reason,
      gains: decision.benefits,
      costs: decision.drawbacks,
      considered: decision.considered,
      revisitWhen: decision.revisitWhen,
    });
  });

  it("creates links with the template's request and response contract", () => {
    const create = edges.find((edge) => edge.source === "creator");
    const data = architectureEdgeDataSchema.parse(create?.data);
    const endpoint = urlShortenerExample.api.endpoints.find(
      (candidate) => candidate.method === data.method && candidate.calledBy.includes("creator"),
    );
    expect(endpoint?.request).toEqual(JSON.parse(data.dataContract?.schema ?? "null"));
    expect(endpoint?.response).toEqual(JSON.parse(data.responseContract?.schema ?? "null"));
  });

  it("only references the example's component keys", () => {
    const keys = new Set(urlShortenerExample.components.components.map(({ key }) => key));
    for (const endpoint of urlShortenerExample.api.endpoints) {
      expect(keys.has(endpoint.service)).toBe(true);
      for (const caller of endpoint.calledBy) {
        expect(keys.has(caller)).toBe(true);
      }
    }
    for (const event of urlShortenerExample.api.events) {
      expect([event.producer, ...event.consumers].every((key) => keys.has(key))).toBe(true);
    }
    expect(keys.has(urlShortenerExample.decision.key)).toBe(true);
  });
});
