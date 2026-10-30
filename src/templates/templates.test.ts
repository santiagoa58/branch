import { describe, it, expect } from "vite-plus/test";
import {
  DIAGRAM_TEMPLATES,
  TEMPLATE_CATEGORIES,
  findTemplates,
  instantiateTemplate,
} from "./index";
import { validateDiagramData } from "@/utils/import";

function itemAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`Expected item at index ${index}`);
  }
  return item;
}

describe.each(DIAGRAM_TEMPLATES.map((t) => [t.name, t] as const))(
  "template: %s",
  (_name, template) => {
    const { nodes, edges, flows } = template.data;

    it("passes the import schema validation", () => {
      expect(validateDiagramData(template.data)).toEqual([]);
    });

    it("lists parent nodes before their children (React Flow requirement)", () => {
      const seen = new Set<string>();
      const childrenBeforeParents: string[] = [];
      for (const node of nodes) {
        if (node.parentId && !seen.has(node.parentId)) {
          childrenBeforeParents.push(node.id);
        }
        seen.add(node.id);
      }
      expect(childrenBeforeParents).toEqual([]);
    });

    it("sets extent and data.parentId consistently on children", () => {
      const children = nodes.filter((node) => node.parentId !== undefined);
      expect(children.filter((node) => node.extent !== "parent").map((node) => node.id)).toEqual(
        [],
      );
      expect(
        children.filter((node) => node.data["parentId"] !== node.parentId).map((node) => node.id),
      ).toEqual([]);
    });

    it("has unique node and edge ids", () => {
      const nodeIds = nodes.map((n) => n.id);
      const edgeIds = edges.map((e) => e.id);
      expect(new Set(nodeIds).size).toBe(nodeIds.length);
      expect(new Set(edgeIds).size).toBe(edgeIds.length);
    });

    it("connects edges and flows to existing nodes", () => {
      const ids = new Set(nodes.map((n) => n.id));
      for (const edge of edges) {
        expect(ids).toContain(edge.source);
        expect(ids).toContain(edge.target);
      }
      for (const flow of flows ?? []) {
        expect(ids).toContain(flow.sourceNodeId);
      }
    });

    it("includes at least one playable flow", () => {
      expect(flows?.length ?? 0).toBeGreaterThan(0);
    });
  },
);

describe("template catalog", () => {
  it("offers many templates with unique ids in every category", () => {
    const ids = DIAGRAM_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DIAGRAM_TEMPLATES.length).toBeGreaterThanOrEqual(24);
    const empty = TEMPLATE_CATEGORIES.filter((c) => findTemplates("", c.id).length === 0);
    expect(empty).toEqual([]);
  });

  it.each([
    ["Google Drive", "cloud-file-storage"],
    ["dropbox", "cloud-file-storage"],
    ["slack", "chat-messaging"],
    ["Uber", "ride-hailing"],
    ["netflix", "recommendation-system"],
    ["stripe webhooks", "payments-platform"],
    ["Elasticsearch", "cloud-file-storage"],
  ])("finds %s", (query, id) => {
    expect(findTemplates(query).map((template) => template.id)).toContain(id);
  });

  it("combines words and categories and returns nothing for unknown products", () => {
    expect(findTemplates("video", "media").every((t) => t.category === "media")).toBe(true);
    expect(findTemplates("zzzz-no-such-product")).toEqual([]);
  });
});

describe("instantiateTemplate", () => {
  const template = itemAt(DIAGRAM_TEMPLATES, 0);

  it("remaps every id so two instances never collide", () => {
    const a = instantiateTemplate(template);
    const b = instantiateTemplate(template);
    const aIds = new Set([...a.nodes.map((n) => n.id), ...a.edges.map((e) => e.id)]);
    for (const id of [...b.nodes.map((n) => n.id), ...b.edges.map((e) => e.id)]) {
      expect(aIds).not.toContain(id);
    }
  });

  it("keeps the instance internally consistent after remapping", () => {
    const instance = instantiateTemplate(template);
    const ids = new Set(instance.nodes.map((n) => n.id));
    const children = instance.nodes.filter((node) => node.parentId !== undefined);
    expect(children.filter((node) => !ids.has(node.parentId ?? "")).map((node) => node.id)).toEqual(
      [],
    );
    expect(
      children.filter((node) => node.data["parentId"] !== node.parentId).map((node) => node.id),
    ).toEqual([]);
    for (const edge of instance.edges) {
      expect(ids).toContain(edge.source);
      expect(ids).toContain(edge.target);
    }
    for (const flow of instance.flows ?? []) {
      expect(ids).toContain(flow.sourceNodeId);
    }
  });

  it("does not share mutable state with the template definition", () => {
    const instance = instantiateTemplate(template);
    itemAt(instance.nodes, 0).position.x = -9999;
    expect(itemAt(template.data.nodes, 0).position.x).not.toBe(-9999);
  });
});
