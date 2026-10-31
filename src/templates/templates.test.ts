import { describe, it, expect } from "vite-plus/test";
import {
  DIAGRAM_TEMPLATES,
  TEMPLATE_CATEGORIES,
  findTemplates,
  instantiateTemplate,
} from "./index";
import { validateDiagramData } from "@/utils/import";
import {
  architectureAttributeInputSchema,
  architectureNodeDataSchema,
  designDecisionSchema,
} from "@/schemas/diagram";
import { decide } from "./reasoning";
import { findIngressBypasses } from "@/utils/designRules";
import { DECISION_LIMITS } from "@/components/ui/DesignDecisionEditor";
import { defineTemplate, type TemplateSpec } from "./define";
import type { ArchitectureNodeData, DesignDecision } from "@/types";

/** Template decisions are meant to be scanned: every section filled, each entry one short phrase. */
function expectShortCompleteDecision(value: unknown, where: string) {
  const decision = designDecisionSchema.parse(value);
  for (const [field, text, limit] of [
    ["choice", decision.choice, DECISION_LIMITS.choice],
    ["reason", decision.reason, DECISION_LIMITS.reason],
  ] as const) {
    expect(text?.trim(), `${where} ${field}`).toBeTruthy();
    expect(text?.length, `${where} ${field}`).toBeLessThanOrEqual(limit);
  }
  const lists = {
    benefits: decision.benefits ?? [],
    drawbacks: decision.drawbacks ?? [],
    revisitWhen: decision.revisitWhen ?? [],
    considered: (decision.considered ?? []).flatMap((item) => [item.option, item.whyNot ?? ""]),
  };
  for (const [field, items] of Object.entries(lists)) {
    expect(items.length, `${where} ${field}`).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.trim(), `${where} ${field}`).toBeTruthy();
      expect(item.length, `${where} ${field}: ${item}`).toBeLessThanOrEqual(DECISION_LIMITS.item);
      expect(item).not.toMatch(/\b(?:TODO|TBD|placeholder)\b/i);
    }
  }
  return decision;
}

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

    it("gives every component and group a short, complete decision", () => {
      const decided = nodes.filter((node) => node.type === "architecture" || node.type === "group");
      expect(decided.length).toBeGreaterThan(0);
      for (const node of decided) {
        expectShortCompleteDecision(node.data.decision, `${template.id}/${node.id}`);
      }
      for (const edge of edges.filter((edge) => edge.data?.decision)) {
        expectShortCompleteDecision(edge.data?.decision, `${template.id}/${edge.id}`);
      }
    });

    it("provides explicitly illustrative numeric attributes with units", () => {
      const attributes = nodes
        .filter((node) => node.type === "architecture")
        .flatMap((node) => architectureNodeDataSchema.parse(node.data).attributes ?? []);
      expect(attributes.length).toBeGreaterThan(0);
      const numericAttributes = attributes.filter((attribute) => /^[-+]?\d/.test(attribute.value));
      expect(numericAttributes.length).toBeGreaterThan(0);
      for (const attribute of attributes) {
        expect(architectureAttributeInputSchema.safeParse(attribute).success).toBe(true);
      }
      for (const attribute of numericAttributes) {
        expect(attribute.name).toMatch(/^Illustrative /);
        expect(attribute.unit?.trim().length).toBeGreaterThan(0);
      }
      for (const edge of edges.filter((edge) => edge.data?.latencyMs !== undefined)) {
        expect(edge.data?.description).toMatch(/illustrative.*ms.*not.*production/i);
      }
    });

    it("does not emit deprecated controls or legacy metadata", () => {
      const deprecated = [
        "metadata",
        "status",
        "healthCheckUrl",
        "port",
        "tags",
        "accent",
        "background",
        "accentColor",
        "backgroundColor",
        "iconColor",
        "technology",
      ];
      for (const data of [template.data, instantiateTemplate(template)]) {
        for (const item of [...data.nodes, ...data.edges]) {
          for (const key of deprecated) {
            expect(item.data, `${item.id}: ${key}`).not.toHaveProperty(key);
          }
        }
      }
    });

    it("preserves reasoning and unit-aware attributes in independent clones", () => {
      const instance = instantiateTemplate(template);
      const second = instantiateTemplate(template);
      for (const [index, original] of nodes.entries()) {
        const cloned = itemAt(instance.nodes, index);
        expect(cloned.data.decision).toEqual(original.data.decision);
        expect(cloned.data.attributes).toEqual(original.data.attributes);
        // Template data was schema-checked above; mutate actual nested references here.
        const clonedDecision = cloned.data.decision as DesignDecision;
        expect(clonedDecision).not.toBe(original.data.decision);
        clonedDecision.reason = "Changed only in this instance.";
        expect(itemAt(second.nodes, index).data.decision).toEqual(original.data.decision);
        expect(designDecisionSchema.parse(original.data.decision).reason).not.toBe(
          clonedDecision.reason,
        );
      }
      for (const [index, original] of [...nodes.entries()].filter(
        ([, node]) => node.type === "architecture",
      )) {
        const originalData = original.data as ArchitectureNodeData;
        const clonedData = itemAt(instance.nodes, index).data as ArchitectureNodeData;
        expect(clonedData.attributes).not.toBe(originalData.attributes);
        for (const [attributeIndex, attribute] of (clonedData.attributes ?? []).entries()) {
          const originalAttribute = itemAt(originalData.attributes ?? [], attributeIndex);
          expect(attribute).not.toBe(originalAttribute);
          attribute.value = "99999";
          attribute.unit = "changed unit";
          expect(itemAt(second.nodes, index).data.attributes).toEqual(originalData.attributes);
          expect(originalAttribute.value).not.toBe("99999");
          expect(originalAttribute.unit).not.toBe("changed unit");
        }
      }
      for (const [index, original] of edges.entries()) {
        expect(itemAt(instance.edges, index).data?.decision).toEqual(original.data?.decision);
      }
      for (const [index, original] of [...edges.entries()].filter(
        ([, edge]) => edge.data?.decision,
      )) {
        const clonedDecision = itemAt(instance.edges, index).data?.decision;
        if (!clonedDecision) {
          throw new Error("Expected cloned edge decision");
        }
        expect(clonedDecision).not.toBe(original.data?.decision);
        clonedDecision.reason = "Changed only in this instance.";
        expect(itemAt(second.edges, index).data?.decision).toEqual(original.data?.decision);
        expect(original.data?.decision?.reason).not.toBe(clonedDecision.reason);
      }
    });

    it("reaches internal components only through an entry point", () => {
      const label = (id: string) => {
        const value = nodes.find((node) => node.id === id)?.data["label"];
        return typeof value === "string" ? value : id;
      };
      expect(
        findIngressBypasses(nodes, edges).map(
          ({ source, target }) => `${label(source)} → ${label(target)}`,
        ),
      ).toEqual([]);
    });

    it("includes at least one playable flow", () => {
      expect(flows?.length ?? 0).toBeGreaterThan(0);
    });
  },
);

describe("defineTemplate", () => {
  const cacheDecision = decide(
    "Redis for catalog reads",
    "Catalog pages are read far more than they change.",
    ["Fewer database reads"],
    ["Entries can be briefly stale"],
    [["Read the database every time", "Repeats the same query constantly"]],
    ["Catalog edits must appear instantly"],
  );
  const spec = {
    id: "reasoning-test",
    name: "Reasoning test",
    category: "web",
    description: "Exercises the template authoring contract.",
    keywords: [],
    highlights: [],
    groups: [{ id: "private", type: "vpc", label: "Private services" }],
    nodes: [
      {
        id: "cache",
        type: "cache",
        label: "Catalog cache",
        in: "private",
        attrs: [{ name: "Illustrative cache capacity", value: "128", unit: "MiB" }],
      },
      { id: "db", type: "database", label: "Catalog records", in: "private" },
    ],
    edges: [
      {
        from: "cache",
        to: "db",
        protocol: "sql",
        decision: decide(
          "Load records on a cache miss",
          "The cache is a projection, not the source of truth.",
          ["Cold entries take no cache space"],
          ["Misses add query latency"],
          [["Preload every record", "Wastes memory on entries nobody reads"]],
          ["Most reads become misses"],
        ),
      },
    ],
    decisions: {
      private: decide(
        "Private network for data services",
        "Nothing outside should reach the cache or database.",
        ["No public addresses on data stores"],
        ["More network setup"],
        [["Public endpoints", "Each store would need its own hardening"]],
        ["Stores move to separate accounts"],
      ),
      cache: cacheDecision,
      db: decide(
        "PostgreSQL for catalog records",
        "Catalog records are relational and change together.",
        ["Atomic updates"],
        ["Single write primary"],
        [["Document store", "Cross-record updates need transactions"]],
        ["Writes outgrow one primary"],
      ),
    },
    flow: { name: "Read", description: "Read catalog data.", from: "cache", color: "#3b82f6" },
  } satisfies TemplateSpec;

  it("attaches each decision by id, maps attrs and keeps edge reasoning through cloning", () => {
    const originalSpec = structuredClone(spec);
    const instance = instantiateTemplate(defineTemplate(spec));
    const group = itemAt(instance.nodes, 0);
    const cache = instance.nodes.find((node) => node.data.label === "Catalog cache");
    const edge = itemAt(instance.edges, 0);
    expect(group.data.decision).toEqual(spec.decisions.private);
    expect(cache?.data.decision).toEqual(cacheDecision);
    expect(cache?.data.decision).not.toBe(cacheDecision);
    expect(cache?.data.attributes).toEqual(itemAt(spec.nodes, 0).attrs);
    expect(edge.data?.decision).toEqual(itemAt(spec.edges, 0).decision);
    expect(edge.data?.decision).not.toBe(itemAt(spec.edges, 0).decision);
    expect(spec).toEqual(originalSpec);
    expect(validateDiagramData(instance)).toEqual([]);
  });

  it("rejects a node without a decision", () => {
    const { db: _db, ...decisions } = spec.decisions;
    expect(() => defineTemplate({ ...spec, decisions })).toThrow(
      'Template "reasoning-test" needs a decision for "db"',
    );
  });

  it("rejects decisions for ids that are not in the template", () => {
    expect(() =>
      defineTemplate({ ...spec, decisions: { ...spec.decisions, gone: cacheDecision } }),
    ).toThrow('Template "reasoning-test" has decisions for unknown ids: gone');
  });
});

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
    ["FFmpeg", "video-streaming"],
    ["pgvector", "rag-chatbot"],
  ])("finds %s", (query, id) => {
    expect(findTemplates(query).map((template) => template.id)).toContain(id);
  });

  it("never reuses the same reasoning for two components", () => {
    const owners = new Map<string, string>();
    const duplicates: string[] = [];
    for (const template of DIAGRAM_TEMPLATES) {
      for (const node of template.data.nodes) {
        const reason = designDecisionSchema.parse(node.data.decision ?? {}).reason?.trim();
        if (!reason) {
          continue;
        }
        const owner = owners.get(reason);
        if (owner) {
          duplicates.push(`${owner} and ${template.id}/${node.id}`);
        }
        owners.set(reason, `${template.id}/${node.id}`);
      }
    }
    expect(duplicates).toEqual([]);
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
