import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { z } from "zod";
import { diagramDataSchema } from "@/schemas/diagram";
import type { DiagramData } from "@/types";

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
            data: { label: "API Service", type: "service", technology: "Node.js", port: "3000" },
          },
        ],
        edges: [],
      };

      exportAsMarkdown(data);

      const blob = getCreatedBlob();
      expect(blob.content).toContain("## Components");
      expect(blob.content).toContain("API Service");
      expect(blob.content).toContain("Node.js");
      expect(blob.content).toContain("3000");
      expect(blob.type).toBe("text/markdown");
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
