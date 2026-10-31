import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { z } from "zod";
import { diagramDataSchema } from "@/schemas/diagram";
import type { DiagramData } from "@/types";
import { importDiagram, parseJSON } from "@/utils/import";
import { architectureNodeTypeSchema } from "@/schemas/diagram";

const metadataExportSchema = z
  .object({
    version: z.string(),
    exportedAt: z.string(),
    metadata: z.object({ appName: z.string() }).passthrough(),
  })
  .passthrough();
const viewportExportSchema = z.object({ viewport: z.unknown().optional() }).passthrough();
const nodesExportSchema = z
  .object({ nodes: z.array(z.object({ type: z.string() }).passthrough()) })
  .passthrough();

function expectDefined<T>(value: T | null | undefined, message: string): asserts value is T {
  expect(value).toBeDefined();
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

function parseJson<T>(content: string, schema: z.ZodType<T>): T {
  const value: unknown = JSON.parse(content);
  return schema.parse(value);
}

// Mock dependencies before importing the module
vi.mock("html-to-image", () => ({
  toPng: vi.fn<() => Promise<string>>().mockResolvedValue("data:image/png;base64,mockdata"),
  toSvg: vi.fn<() => Promise<string>>().mockResolvedValue("data:image/svg+xml;base64,mockdata"),
}));

vi.mock("jspdf", () => ({
  jsPDF: vi.fn<() => object>().mockImplementation(() => ({
    internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } },
    setFontSize: vi.fn<(...args: unknown[]) => void>(),
    setTextColor: vi.fn<(...args: unknown[]) => void>(),
    setFillColor: vi.fn<(...args: unknown[]) => void>(),
    rect: vi.fn<(...args: unknown[]) => void>(),
    text: vi.fn<(...args: unknown[]) => void>(),
    addImage: vi.fn<(...args: unknown[]) => void>(),
    save: vi.fn<(...args: unknown[]) => void>(),
  })),
}));

// Import after mocking
import { exportAsMarkdown, exportAsJson, generateShareableLink } from "@/utils/export";

describe("export utilities", () => {
  let mockLink: HTMLAnchorElement;
  let createdBlobs: Array<{ content: string; type: string }> = [];
  const createElementMock = vi.fn<(tagName: string) => HTMLElement>();
  const createObjectURLMock = vi.fn<(blob: Blob | MediaSource) => string>();
  const clickMock = vi.fn<() => void>();

  function getCreatedBlob(): { content: string; type: string } {
    expect(createdBlobs).toHaveLength(1);
    const blob = createdBlobs[0];
    expectDefined(blob, "Expected one exported blob");
    return blob;
  }

  beforeEach(() => {
    // Track created blobs
    createdBlobs = [];

    // Mock Blob constructor
    class MockBlob {
      content: string;
      type: string;
      size: number;

      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        const firstPart = parts[0];
        expectDefined(firstPart, "Expected exported blob content");
        this.content =
          typeof firstPart === "string"
            ? firstPart
            : firstPart instanceof ArrayBuffer || ArrayBuffer.isView(firstPart)
              ? new TextDecoder().decode(firstPart)
              : "";
        this.type = options?.type || "";
        this.size = this.content.length;
        createdBlobs.push({ content: this.content, type: this.type });
      }
    }
    vi.stubGlobal("Blob", MockBlob);

    // Mock DOM elements and methods
    mockLink = document.createElement("a");
    clickMock.mockClear();
    mockLink.click = clickMock;
    createElementMock.mockReturnValue(mockLink);
    createObjectURLMock.mockReturnValue("blob:mock-url");
    vi.spyOn(document, "createElement").mockImplementation((tagName) => createElementMock(tagName));
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => createObjectURLMock(blob));
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    // Mock window.location
    Object.defineProperty(window, "location", {
      value: { href: "http://localhost:3000", search: "" },
      writable: true,
      configurable: true,
    });

    // Mock navigator.clipboard
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("exportAsMarkdown", () => {
    it("should export diagram data as markdown", () => {
      const data: DiagramData = {
        nodes: [
          {
            id: "node-1",
            type: "architecture",
            position: { x: 0, y: 0 },
            data: { label: "API Service", type: "service", technology: "Node.js" },
          },
          {
            id: "node-2",
            type: "architecture",
            position: { x: 200, y: 0 },
            data: { label: "Database", type: "database", technology: "PostgreSQL" },
          },
        ],
        edges: [{ id: "edge-1", source: "node-1", target: "node-2", data: { protocol: "sql" } }],
      };

      exportAsMarkdown(data);

      expect(createElementMock).toHaveBeenCalledWith("a");
      expect(createObjectURLMock).toHaveBeenCalled();
      expect(mockLink.download).toContain("branch-diagram-");
      expect(mockLink.download).toContain(".md");
      expect(clickMock).toHaveBeenCalled();
    });

    it("should include components in markdown table", () => {
      const data: DiagramData = {
        nodes: [
          {
            id: "node-1",
            type: "architecture",
            position: { x: 0, y: 0 },
            data: {
              label: "API Service (Node.js)",
              type: "service",
              description: "Public API",
              technology: "Legacy runtime",
              port: "3000",
            },
          },
        ],
        edges: [],
      };

      exportAsMarkdown(data);

      const blob = getCreatedBlob();
      expect(blob.content).toContain("## Components");
      expect(blob.content).toContain("API Service");
      expect(blob.content).toContain("Node.js");
      expect(blob.content).toContain("| Component | Type | Description |");
      expect(blob.content).toContain("Public API");
      expect(blob.content).not.toContain("| Technology |");
      expect(blob.content).not.toContain("| Port |");
      expect(blob.content).not.toContain("Legacy runtime");
      expect(blob.content).not.toContain("3000");
      expect(blob.type).toBe("text/markdown");
    });

    it("documents decisions for components, groups, and connections with attribute units", () => {
      const decision = {
        choice: "PostgreSQL primary",
        reason: "Atomic account updates",
        benefits: ["Constraints protect balances", "Mature tooling"],
        drawbacks: ["Write contention needs monitoring"],
        considered: [{ option: "Document store", whyNot: "Weaker relational constraints" }],
        revisitWhen: ["Writes outgrow one primary"],
      };
      const data = diagramDataSchema.parse({
        nodes: [
          {
            id: "group-1",
            type: "group",
            position: { x: 0, y: 0 },
            data: {
              label: "Private boundary",
              groupType: "vpc",
              decision: { ...decision, choice: "Isolated application network" },
            },
          },
          {
            id: "node-1",
            type: "architecture",
            position: { x: 20, y: 20 },
            parentId: "group-1",
            extent: "parent",
            data: {
              label: "Accounts database",
              type: "database",
              decision,
              attributes: [
                { name: "Read latency", value: "25", unit: "ms" },
                { name: "Replicas", value: "3", unit: "replicas" },
                { name: "Consistency", value: "Strong" },
              ],
              metadata: { "Read latency": "old value", Owner: "Accounts team", Shards: "2" },
            },
          },
        ],
        edges: [
          {
            id: "edge-1",
            source: "node-1",
            target: "node-1",
            data: { protocol: "sql", decision: { ...decision, choice: "Transactional writes" } },
          },
        ],
      });
      const original = structuredClone(data);

      exportAsMarkdown(data);

      const { content } = getCreatedBlob();
      expect(content).toContain("## Architecture Details");
      expect(content).toContain("### Component: Accounts database");
      expect(content).toContain("### Group: Private boundary");
      expect(content).toContain("### Connection: Accounts database → Accounts database (edge-1)");
      for (const choice of [
        "PostgreSQL primary",
        "Isolated application network",
        "Transactional writes",
      ]) {
        expect(content).toContain(`| Choice | ${choice} |`);
      }
      // One row per item, repeated once each for the group, component and connection.
      for (const row of [
        "| Why | Atomic account updates |",
        "| Benefit | Constraints protect balances |",
        "| Benefit | Mature tooling |",
        "| Drawback | Write contention needs monitoring |",
        "| Considered | Document store — Weaker relational constraints |",
        "| Revisit when | Writes outgrow one primary |",
      ]) {
        expect(content.split(row)).toHaveLength(4);
      }
      expect(content).toContain("| Read latency | 25 | ms |");
      expect(content).toContain("| Replicas | 3 | replicas |");
      expect(content).toContain("| Consistency | Strong |  |");
      expect(content).toContain("| Owner | Accounts team |  |");
      expect(content).toContain("| Shards | 2 |  |");
      expect(content).not.toContain("old value");
      expect(data).toEqual(original);
    });

    it("exports a partial decision without requiring a choice or attributes", () => {
      const data: DiagramData = {
        nodes: [
          {
            id: "node-1",
            type: "architecture",
            position: { x: 0, y: 0 },
            data: {
              label: "Legacy service",
              type: "service",
              decision: { reason: "Keep existing reasoning", drawbacks: ["Extra network hop"] },
              metadata: { Capacity: "100" },
            },
          },
        ],
        edges: [],
      };

      exportAsMarkdown(data);

      const { content } = getCreatedBlob();
      expect(content).toContain("| Why | Keep existing reasoning |");
      expect(content).toContain("| Drawback | Extra network hop |");
      expect(content).toContain("| Capacity | 100 |  |");
      expect(content).not.toContain("| Choice |");
      expect(content).not.toContain("undefined");
    });

    it("escapes table values and keeps multiline reasoning in a single table row", () => {
      const data = diagramDataSchema.parse({
        nodes: [
          {
            id: "group-1",
            type: "group",
            position: { x: 0, y: 0 },
            data: { label: "Group | west", groupType: "vpc", description: "Line 1\r\nLine 2" },
          },
          {
            id: "node-1",
            type: "architecture",
            position: { x: 0, y: 0 },
            data: {
              label: "API | public",
              type: "service",
              description: "<script> & *literal*",
              decision: {
                reason: "First | second\nNext `option`\rLast [choice]",
                benefits: ["Fast | cheap"],
              },
              attributes: [{ name: "Rate | limit", value: "10\n20", unit: "requests/s" }],
            },
          },
          {
            id: "missing|node",
            type: "comment",
            position: { x: 200, y: 0 },
            data: { text: "An endpoint without a label" },
          },
        ],
        edges: [
          {
            id: "edge-1",
            source: "node-1",
            target: "missing|node",
            data: {
              protocol: "http",
              method: "GET",
              description: "Reads | writes\nwith retries",
              decision: { drawbacks: ["Retry | duplicate\nDeduplicate"] },
            },
          },
        ],
      });

      exportAsMarkdown(data);

      const { content } = getCreatedBlob();
      expect(content).toContain("| Group \\| west | VPC | Line 1<br>Line 2 |");
      expect(content).toContain(
        "| API \\| public | Service | &lt;script&gt; &amp; \\*literal\\* |",
      );
      expect(content).toContain(
        "| Why | First \\| second<br>Next \\`option\\`<br>Last \\[choice\\] |",
      );
      expect(content).toContain("| Benefit | Fast \\| cheap |");
      expect(content).toContain("| Rate \\| limit | 10<br>20 | requests/s |");
      expect(content).toContain(
        "| API \\| public | missing\\|node | http | GET | Reads \\| writes<br>with retries |",
      );
      expect(content).toContain("| Drawback | Retry \\| duplicate<br>Deduplicate |");
    });

    it("omits empty detail sections and comments", () => {
      const data = diagramDataSchema.parse({
        nodes: [
          {
            id: "node-1",
            type: "architecture",
            position: { x: 0, y: 0 },
            data: { label: "API", type: "service", decision: { reason: "  " } },
          },
          {
            id: "comment-1",
            type: "comment",
            position: { x: 0, y: 0 },
            data: { text: "Private scratch notes" },
          },
        ],
        edges: [],
      });

      exportAsMarkdown(data);

      const { content } = getCreatedBlob();
      expect(content).not.toContain("## Architecture Details");
      expect(content).not.toContain("## Connections");
      expect(content).not.toContain("Private scratch notes");
    });

    it.each([undefined, "", "Public API"])(
      "reimports current Markdown components and connections with description %j",
      (description) => {
        const data: DiagramData = {
          nodes: [
            {
              id: "api",
              type: "architecture",
              position: { x: 0, y: 0 },
              data: {
                label: "API",
                type: "service",
                ...(description !== undefined ? { description } : {}),
              },
            },
            {
              id: "database",
              type: "architecture",
              position: { x: 200, y: 0 },
              data: { label: "DB", type: "database", description: "Storage" },
            },
          ],
          edges: [{ id: "query", source: "api", target: "database", data: { protocol: "sql" } }],
        };

        exportAsMarkdown(data);
        const result = importDiagram(getCreatedBlob().content);

        expect(result.success).toBe(true);
        expect(result.data?.nodes.map((node) => node.data)).toEqual([
          { label: "API", type: "service", ...(description ? { description } : {}) },
          { label: "DB", type: "database", description: "Storage" },
        ]);
        expect(result.data?.edges).toHaveLength(1);
        const edge = result.data?.edges[0];
        expect(edge?.source).toBe(result.data?.nodes[0]?.id);
        expect(edge?.target).toBe(result.data?.nodes[1]?.id);
        expect(edge?.data).toEqual({ protocol: "sql" });
      },
    );

    it("reimports every exported component type from its configured display label", () => {
      const data: DiagramData = {
        nodes: architectureNodeTypeSchema.options.map((type, index) => ({
          id: type,
          type: "architecture",
          position: { x: index * 200, y: 0 },
          data: { label: `Component ${type}`, type },
        })),
        edges: [],
      };

      exportAsMarkdown(data);
      const result = importDiagram(getCreatedBlob().content);

      expect(result.success).toBe(true);
      expect(result.data?.nodes.map((node) => node.data)).toEqual(
        data.nodes.map((node) => node.data),
      );
    });

    it("reimports grouped children, escaped text, component reasoning and explicit attribute units", () => {
      const decision = {
        choice: "Stateless *API*",
        reason: "Scale | independently\nPreserve <br> &lt; literally",
        benefits: ["Scales | per service", "Independent deploys"],
        drawbacks: ["Network overhead"],
        considered: [{ option: "A [monolith] or `worker`", whyNot: "One <deploy> for all" }],
        revisitWhen: ["Illustrative workload changes"],
      };
      const attributes = [
        { name: "Latency | budget", value: "25", unit: "ms" },
        { name: "Throughput", value: "100", unit: "requests/s" },
        { name: "Policy", value: "Keep \\ paths\nand <tags>" },
      ];
      const label = "API \\| public & <br> *[v1]*\nWest";
      const description = "<script> & \\ literal\nNew line";
      const data = diagramDataSchema.parse({
        nodes: [
          {
            id: "group",
            type: "group",
            position: { x: 0, y: 0 },
            data: { label: "Boundary", groupType: "vpc", decision: { choice: "Isolation" } },
          },
          {
            id: "api",
            type: "architecture",
            parentId: "group",
            extent: "parent",
            position: { x: 20, y: 20 },
            data: { label, type: "service", description, decision, attributes },
          },
          {
            id: "worker",
            type: "architecture",
            parentId: "group",
            extent: "parent",
            position: { x: 200, y: 20 },
            data: { label: "Worker | east", type: "worker", metadata: { Replicas: "3" } },
          },
        ],
        edges: [
          {
            id: "dispatch",
            source: "api",
            target: "worker",
            data: { protocol: "http", method: "POST", description: "Dispatch | work\nvia <br>" },
          },
          { id: "reply", source: "worker", target: "api", data: {} },
        ],
      });
      const original = structuredClone(data);

      exportAsMarkdown(data);
      const result = importDiagram(getCreatedBlob().content);

      expect(result.success).toBe(true);
      expect(result.data?.nodes.map((node) => node.data)).toEqual([
        { label, type: "service", description, decision, attributes },
        { label: "Worker | east", type: "worker", attributes: [{ name: "Replicas", value: "3" }] },
      ]);
      expect(
        result.data?.nodes.every((node) => node.type === "architecture" && !node.parentId),
      ).toBe(true);
      expect(result.data?.edges.map((edge) => [edge.source, edge.target, edge.data])).toEqual([
        [
          "md-import-0",
          "md-import-1",
          { protocol: "http", method: "POST", description: "Dispatch | work\nvia <br>" },
        ],
        ["md-import-1", "md-import-0", {}],
      ]);
      expect(result.warnings?.join(" ")).toContain("not group containers/hierarchy");
      expect(data).toEqual(original);
    });

    it("should include mermaid diagram section", () => {
      const data: DiagramData = {
        nodes: [
          {
            id: "node-1",
            type: "architecture",
            position: { x: 0, y: 0 },
            data: { label: "Service A", type: "service" },
          },
          {
            id: "node-2",
            type: "architecture",
            position: { x: 200, y: 0 },
            data: { label: "Service B", type: "service" },
          },
        ],
        edges: [{ id: "edge-1", source: "node-1", target: "node-2", data: { protocol: "http" } }],
      };

      exportAsMarkdown(data);

      const blob = getCreatedBlob();
      expect(blob.content).toContain("```mermaid");
      expect(blob.content).toContain("graph TD");
    });

    it("should include connections section when edges exist", () => {
      const data: DiagramData = {
        nodes: [
          {
            id: "node-1",
            type: "architecture",
            position: { x: 0, y: 0 },
            data: { label: "API", type: "service" },
          },
          {
            id: "node-2",
            type: "architecture",
            position: { x: 200, y: 0 },
            data: { label: "DB", type: "database" },
          },
        ],
        edges: [
          {
            id: "edge-1",
            source: "node-1",
            target: "node-2",
            data: { protocol: "sql", description: "Database connection" },
          },
        ],
      };

      exportAsMarkdown(data);

      const blob = getCreatedBlob();
      expect(blob.content).toContain("## Connections");
      expect(blob.content).toContain("API");
      expect(blob.content).toContain("DB");
      expect(blob.content).toContain("sql");
    });

    it("should include groups section when groups exist", () => {
      const data = diagramDataSchema.parse({
        nodes: [
          {
            id: "group-1",
            type: "group",
            position: { x: 0, y: 0 },
            data: { label: "VPC", groupType: "vpc", description: "Main VPC" },
          },
          {
            id: "node-1",
            type: "architecture",
            position: { x: 50, y: 50 },
            data: { label: "Service", type: "service" },
            parentId: "group-1",
          },
        ],
        edges: [],
      });

      exportAsMarkdown(data);

      const blob = getCreatedBlob();
      expect(blob.content).toContain("## Infrastructure Groups");
      expect(blob.content).toContain("VPC");
    });
  });

  describe("exportAsJson", () => {
    it("should export diagram data as JSON", () => {
      const data: DiagramData = {
        nodes: [
          {
            id: "node-1",
            type: "architecture",
            position: { x: 0, y: 0 },
            data: { label: "Test", type: "service" },
          },
        ],
        edges: [],
      };

      exportAsJson(data);

      expect(createElementMock).toHaveBeenCalledWith("a");
      expect(mockLink.download).toContain(".json");
      expect(clickMock).toHaveBeenCalled();
    });

    it("round-trips legacy JSON fields losslessly alongside decisions and attributes", () => {
      const legacy: DiagramData = {
        nodes: [
          {
            id: "node-1",
            type: "architecture",
            position: { x: 12, y: 34 },
            data: {
              label: "Old service",
              type: "service",
              technology: "Node.js",
              port: "3000",
              status: "warning",
              healthCheckUrl: "https://example.com/health",
              tags: ["critical", "payments"],
              iconifyIcon: "logos:nodejs-icon",
              iconColor: "#ffffff",
              accentColor: "#123456",
              backgroundColor: "#654321",
              metadata: { replicas: "3", owner: "payments" },
              decision: { reason: "Original rationale", drawbacks: ["Original tradeoff"] },
            },
          },
          {
            id: "node-2",
            type: "architecture",
            position: { x: 200, y: 34 },
            data: {
              label: "New service",
              type: "service",
              decision: {
                choice: "Stateless worker",
                revisitWhen: ["Delivery must be exactly once"],
              },
              attributes: [{ name: "Capacity", value: "50", unit: "requests/s" }],
            },
          },
        ],
        edges: [
          {
            id: "edge-1",
            source: "node-1",
            target: "node-2",
            data: { protocol: "http", tags: ["legacy"], decision: { reason: "Existing link" } },
          },
        ],
        viewport: { x: 10, y: 20, zoom: 1.5 },
      };
      const imported = parseJSON(JSON.stringify(legacy));
      expect(imported.success).toBe(true);
      expect(imported.data).toEqual(legacy);
      expectDefined(imported.data, "Expected legacy JSON import");

      exportAsJson(imported.data, { includeMetadata: false });

      const { content } = getCreatedBlob();
      expect(parseJson(content, diagramDataSchema)).toEqual(legacy);
      expect(parseJSON(content).data).toEqual(legacy);
      expect(imported.data).toEqual(legacy);
    });

    it("should include version and metadata when includeMetadata is true", () => {
      const data: DiagramData = { nodes: [], edges: [] };

      exportAsJson(data, { includeMetadata: true });

      const blob = getCreatedBlob();
      const parsed = parseJson(blob.content, metadataExportSchema);
      expect(parsed.version).toBeDefined();
      expect(parsed.exportedAt).toBeDefined();
      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.appName).toBe("Branch");
    });

    it("should exclude viewport when includeViewport is false", () => {
      const data: DiagramData = {
        nodes: [],
        edges: [],
        viewport: { x: 100, y: 100, zoom: 2 },
      };

      exportAsJson(data, { includeViewport: false });

      const blob = getCreatedBlob();
      const parsed = parseJson(blob.content, viewportExportSchema);
      expect(parsed.viewport).toBeUndefined();
    });

    it("should filter out comments when includeComments is false", () => {
      const data = diagramDataSchema.parse({
        nodes: [
          {
            id: "node-1",
            type: "architecture",
            position: { x: 0, y: 0 },
            data: { label: "Service", type: "service" },
          },
          {
            id: "comment-1",
            type: "comment",
            position: { x: 100, y: 100 },
            data: { text: "A comment" },
          },
        ],
        edges: [],
      });

      exportAsJson(data, { includeComments: false });

      const blob = getCreatedBlob();
      const parsed = parseJson(blob.content, nodesExportSchema);
      expect(parsed.nodes).toHaveLength(1);
      const node = parsed.nodes[0];
      expectDefined(node, "Expected one exported node");
      expect(node.type).toBe("architecture");
    });

    it("should pretty print JSON when prettyPrint is true", () => {
      const data: DiagramData = { nodes: [], edges: [] };

      exportAsJson(data, { prettyPrint: true });

      const blob = getCreatedBlob();
      expect(blob.content).toContain("\n");
      expect(blob.content).toContain("  "); // indentation
    });

    it("should not pretty print JSON when prettyPrint is false", () => {
      const data: DiagramData = { nodes: [], edges: [] };

      exportAsJson(data, { prettyPrint: false, includeMetadata: false });

      const blob = getCreatedBlob();
      expect(blob.content).not.toContain("\n");
    });
  });

  describe("generateShareableLink", () => {
    it("copies a private document URL without embedding a document snapshot", () => {
      Object.defineProperty(window, "location", {
        value: { href: "http://localhost/projects/p/diagrams/d?diagram=legacy#old" },
        writable: true,
        configurable: true,
      });
      expect(generateShareableLink()).toBe("http://localhost/projects/p/diagrams/d");
    });
    it("rejects links that are not cloud document routes", () => {
      Object.defineProperty(window, "location", {
        value: { href: "http://localhost/" },
        writable: true,
        configurable: true,
      });
      expect(() => generateShareableLink()).toThrow(/cloud diagram/);
    });
  });

  describe("export file naming", () => {
    it("should include timestamp in exported JSON filename", () => {
      const data: DiagramData = { nodes: [], edges: [] };

      exportAsJson(data);

      expect(mockLink.download).toMatch(/branch-diagram-\d+\.json/);
    });

    it("should include timestamp in exported markdown filename", () => {
      const data: DiagramData = { nodes: [], edges: [] };

      exportAsMarkdown(data);

      expect(mockLink.download).toMatch(/branch-diagram-\d+\.md/);
    });
  });
});
