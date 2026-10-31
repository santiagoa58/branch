import type { ArchitectureEdge, ArchitectureNodeType, DiagramData, DiagramNode } from "@/types";
import { NODE_TYPES_CONFIG } from "@/constants";
import { parseDecisionRows } from "@/utils/designDecision";
import {
  architectureAttributeSchema,
  architectureNodeDataSchema,
  designDecisionSchema,
  architectureEdgeDataSchema,
  architectureNodeTypeSchema,
  diagramDataSchema,
  formatZodIssues,
} from "@/schemas/diagram";

// Current schema version for import/export compatibility
export const SCHEMA_VERSION = "1.0.0";

export interface ImportOptions {
  mode: "replace" | "merge" | "append";
  includeViewport: boolean;
}

export interface ImportResult {
  success: boolean;
  data?: DiagramData;
  errors?: string[];
  warnings?: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}

// Validate persisted diagram structure with Zod, then apply graph-level integrity checks.
export function validateDiagramData(data: unknown): ValidationError[] {
  const result = diagramDataSchema.safeParse(data);
  if (!result.success) {
    return formatZodIssues(result.error).map((issue) => ({
      field: issue.path.replace(/^\$\.?/, "") || "root",
      message: issue.message,
      severity: "error" as const,
    }));
  }

  const errors: ValidationError[] = [];
  const nodeIds = new Set(result.data.nodes.map((node) => node.id));

  result.data.flows?.forEach((flow, index) => {
    if (!nodeIds.has(flow.sourceNodeId)) {
      errors.push({
        field: `flows[${index}].sourceNodeId`,
        message: `Flow "${flow.name}" references a missing source node ${flow.sourceNodeId}`,
        severity: "warning",
      });
    }
  });

  return errors;
}

// Parse JSON with error handling
export function parseJSON(jsonString: string): ImportResult {
  try {
    const data: unknown = JSON.parse(jsonString);
    const parsed = diagramDataSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        errors: formatZodIssues(parsed.error).map((issue) => `${issue.path}: ${issue.message}`),
      };
    }

    const validation = validateDiagramData(parsed.data);
    const warnings = validation.filter((error) => error.severity === "warning");
    const errors = validation.filter((error) => error.severity === "error");
    if (errors.length > 0) {
      return {
        success: false,
        errors: errors.map((error) => `${error.field}: ${error.message}`),
        ...(warnings.length > 0
          ? { warnings: warnings.map((warning) => `${warning.field}: ${warning.message}`) }
          : {}),
      };
    }

    return {
      success: true,
      data: parsed.data,
      ...(warnings.length > 0
        ? { warnings: warnings.map((warning) => `${warning.field}: ${warning.message}`) }
        : {}),
    };
  } catch (error) {
    return {
      success: false,
      errors: [`JSON parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`],
    };
  }
}

// Merge diagrams (append nodes/edges with new IDs to avoid conflicts)
export function mergeDiagramData(
  current: DiagramData,
  imported: DiagramData,
  offset = { x: 100, y: 100 },
): DiagramData {
  // Generate ID mapping for imported nodes
  const idMapping = new Map<string, string>();
  imported.nodes.forEach((node) => {
    idMapping.set(node.id, `imported-${Date.now()}-${node.id}`);
  });

  // Transform imported nodes
  const transformedNodes: DiagramNode[] = imported.nodes.map((node) => {
    const dataParentId = node.data["parentId"];
    const mappedParentId =
      typeof dataParentId === "string" ? idMapping.get(dataParentId) : undefined;

    return {
      ...node,
      id: idMapping.get(node.id) ?? node.id,
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y,
      },
      ...(mappedParentId ? { data: { ...node.data, parentId: mappedParentId } } : {}),
    };
  });

  // Transform imported edges
  const transformedEdges: ArchitectureEdge[] = imported.edges.map((edge) => ({
    ...edge,
    id: `imported-${Date.now()}-${edge.id}`,
    source: idMapping.get(edge.source) || edge.source,
    target: idMapping.get(edge.target) || edge.target,
  }));

  return {
    nodes: [...current.nodes, ...transformedNodes],
    edges: [...current.edges, ...transformedEdges],
    ...(current.viewport ? { viewport: current.viewport } : {}),
  };
}

// Append diagram data (similar to merge but simpler - just adds new content)
export function appendDiagramData(
  current: DiagramData,
  imported: DiagramData,
  offset = { x: 100, y: 100 },
): DiagramData {
  // Offset all imported nodes
  const offsetNodes: DiagramNode[] = imported.nodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x + offset.x,
      y: node.position.y + offset.y,
    },
  }));

  return {
    nodes: [...current.nodes, ...offsetNodes],
    edges: [...current.edges, ...imported.edges],
    ...(current.viewport ? { viewport: current.viewport } : {}),
  };
}

function decodeMarkdownCell(value: string): string {
  return value
    .trim()
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\\([\\`*_[\]|])/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function markdownColumns(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  const row = line.trim();
  for (let index = 0; index < row.length; index++) {
    const character = row[index];
    if (character === "\\" && index + 1 < row.length) {
      cell += character + row[++index];
    } else if (character === "|") {
      cells.push(cell);
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell);
  if (row.startsWith("|")) {
    cells.shift();
  }
  if (row.endsWith("|") && cell === "") {
    cells.pop();
  }
  return cells;
}

function markdownSection(markdown: string, heading: string): string {
  const section = markdown.split(/^## /m).find((part) => part.startsWith(`${heading}\n`));
  return section?.slice(heading.length + 1) ?? "";
}

function markdownTable(section: string, column: string, companion: string): Map<string, string>[] {
  const lines = section.split("\n");
  const headerIndex = lines.findIndex((line, index) => {
    if (!line.trim().startsWith("|")) {
      return false;
    }
    const cells = markdownColumns(line).map((cell) => cell.trim().toLowerCase());
    const separator = markdownColumns(lines[index + 1] ?? "");
    return (
      cells.includes(column) &&
      cells.includes(companion) &&
      separator.length === cells.length &&
      separator.every((cell) => /^:?-+:?$/.test(cell.trim()))
    );
  });
  if (headerIndex < 0) {
    return [];
  }
  const headers = markdownColumns(lines[headerIndex] ?? "").map((cell) =>
    cell.trim().toLowerCase(),
  );

  const rows: Map<string, string>[] = [];
  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.trim().startsWith("|")) {
      break;
    }
    const cells = markdownColumns(line);
    if (cells.length !== headers.length) {
      throw new Error(`Expected ${headers.length} columns in "${column}" table`);
    }
    rows.push(
      new Map(headers.map((header, index) => [header, decodeMarkdownCell(cells[index] ?? "")])),
    );
  }
  return rows;
}

// Parse Markdown export back to diagram data
export function parseMarkdown(markdown: string): ImportResult {
  try {
    const nodes: DiagramNode[] = [];
    const edges: ArchitectureEdge[] = [];

    markdown = markdown.replace(/\r\n?/g, "\n");
    const configuredTypes = new Map(
      Object.entries(NODE_TYPES_CONFIG).map(([type, config]) => [config.label.toLowerCase(), type]),
    );
    const componentRows = markdownTable(
      markdownSection(markdown, "Components"),
      "component",
      "type",
    );
    componentRows.forEach((row, index) => {
      const label = row.get("component");
      const typeStr = row.get("type");
      const technology = row.get("technology");
      const port = row.get("port");
      const description = row.get("description");
      if (!label || !typeStr) {
        throw new Error("Each component row requires a Component and Type");
      }
      // Map type string to node type
      const typeMap: Record<string, ArchitectureNodeType> = {
        microservice: "service",
        service: "service",
        database: "database",
        "sql database": "database",
        "nosql database": "database",
        "message queue": "queue",
        queue: "queue",
        cache: "cache",
        "in-memory cache": "cache",
        "api gateway": "gateway",
        gateway: "gateway",
        "load balancer": "gateway",
        "external api": "external",
        external: "external",
        "third-party": "external",
        "object storage": "storage",
        storage: "storage",
        "web client": "client",
        "mobile client": "client",
        client: "client",
      };

      const normalizedType = typeStr.toLowerCase();
      const parsedType = architectureNodeTypeSchema.safeParse(
        configuredTypes.get(normalizedType) ?? typeMap[normalizedType] ?? normalizedType,
      );
      if (!parsedType.success) {
        throw new Error(`Unsupported component type "${typeStr}"`);
      }
      const nodeType = parsedType.data;

      nodes.push({
        id: `md-import-${index}`,
        type: "architecture",
        position: { x: 100 + (index % 3) * 250, y: 100 + Math.floor(index / 3) * 180 },
        data: {
          label,
          type: nodeType,
          ...(technology && technology !== "-" ? { technology } : {}),
          ...(port && port !== "-" ? { port } : {}),
          ...(description && description !== "-" ? { description } : {}),
        },
      });
    });

    // Create node ID map for edge resolution
    const nodeNameToId = new Map<string, string>();
    nodes.forEach((node) => {
      if (node.data?.label && typeof node.data.label === "string") {
        nodeNameToId.set(node.data.label, node.id);
      }
    });

    const connectionRows = markdownTable(
      markdownSection(markdown, "Connections"),
      "source",
      "target",
    );
    connectionRows.forEach((row, index) => {
      const source = row.get("source");
      const target = row.get("target");
      const protocol = row.get("protocol");
      const method = row.get("method");
      const description = row.get("description");
      if (!source || !target) {
        throw new Error("Each connection row requires a Source and Target");
      }
      for (const label of [source, target]) {
        if (nodes.filter((node) => node.data["label"] === label).length > 1) {
          throw new Error(
            `Ambiguous connection endpoint "${label}"; use unique labels or JSON import`,
          );
        }
      }
      const sourceId = nodeNameToId.get(source);
      const targetId = nodeNameToId.get(target);

      const edgeData = architectureEdgeDataSchema.parse({
        ...(protocol && protocol !== "-" ? { protocol: protocol.toLowerCase() } : {}),
        ...(method && method !== "-" ? { method } : {}),
        ...(description && description !== "-" ? { description } : {}),
      });

      edges.push({
        id: `md-edge-${index}`,
        source: sourceId ?? source,
        target: targetId ?? target,
        type: "architecture",
        data: edgeData,
      });
    });

    // Component detail headings identify components by label, not by their regenerated IDs.
    const details = markdownSection(markdown, "Architecture Details").split(/^### /m).slice(1);
    for (const section of details) {
      const heading = section.split("\n", 1)[0] ?? "";
      if (!heading.startsWith("Component: ")) {
        continue;
      }
      const label = decodeMarkdownCell(heading.slice("Component: ".length));
      const matches = nodes.filter((node) => node.data["label"] === label);
      if (matches.length !== 1) {
        throw new Error(`Component details require a unique component label "${label}"`);
      }
      const node = matches[0];
      if (!node) {
        continue;
      }
      const decisionRows = markdownTable(section, "decision", "details");
      const decision = parseDecisionRows(
        decisionRows.map((row): [string, string] => [
          row.get("decision") ?? "",
          row.get("details") ?? "",
        ]),
      );
      const attributeRows = markdownTable(section, "attribute", "value");
      node.data = architectureNodeDataSchema.parse({
        ...node.data,
        ...(decisionRows.length > 0 ? { decision: designDecisionSchema.parse(decision) } : {}),
        ...(attributeRows.length > 0
          ? {
              attributes: architectureAttributeSchema.array().parse(
                attributeRows.map((row) => ({
                  name: row.get("attribute"),
                  value: row.get("value"),
                  ...(row.get("unit") ? { unit: row.get("unit") } : {}),
                })),
              ),
            }
          : {}),
      });
    }

    // Also try to parse Mermaid diagram if no tables found
    if (nodes.length === 0) {
      const mermaidMatch = markdown.match(/```mermaid\n([\s\S]*?)\n```/);
      const mermaidCode = mermaidMatch?.[1];
      if (mermaidCode) {
        const lines = mermaidCode
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l);

        const nodePattern = /^([a-zA-Z0-9_]+)\[(.*?)\]$/;
        const edgePattern = /^([a-zA-Z0-9_]+)\s*-->\s*([a-zA-Z0-9_]+)/;

        const mermaidNodeMap = new Map<string, string>();

        lines.forEach((line, index) => {
          // Parse node definitions
          const nodeMatch = line.match(nodePattern);
          const id = nodeMatch?.[1];
          const label = nodeMatch?.[2];
          if (id && label) {
            const nodeId = `mermaid-${id}`;
            mermaidNodeMap.set(id, nodeId);

            nodes.push({
              id: nodeId,
              type: "architecture",
              position: { x: 100 + (index % 3) * 250, y: 100 + Math.floor(index / 3) * 180 },
              data: {
                label,
                type: "service",
              },
            });
          }

          // Parse edge definitions
          const edgeMatch = line.match(edgePattern);
          const source = edgeMatch?.[1];
          const target = edgeMatch?.[2];
          if (source && target) {
            const sourceId = mermaidNodeMap.get(source);
            const targetId = mermaidNodeMap.get(target);

            if (sourceId && targetId) {
              edges.push({
                id: `mermaid-edge-${edges.length}`,
                source: sourceId,
                target: targetId,
                type: "architecture",
                data: {},
              });
            }
          }
        });
      }
    }

    if (nodes.length === 0) {
      return {
        success: false,
        errors: [
          "No valid nodes found in markdown. Expected ## Components table or Mermaid diagram.",
        ],
      };
    }

    const diagramData: DiagramData = { nodes, edges };
    const errors = validateDiagramData(diagramData);
    const criticalErrors = errors.filter((e) => e.severity === "error");

    if (criticalErrors.length > 0) {
      return {
        success: false,
        errors: criticalErrors.map((e) => `${e.field}: ${e.message}`),
      };
    }

    return {
      success: true,
      data: diagramData,
      warnings: [
        `Imported ${nodes.length} nodes and ${edges.length} edges from markdown`,
        "Markdown restores components, connections and component details, not group containers/hierarchy, connection decisions, original IDs, positions or advanced fields. Use JSON for a full-fidelity restore.",
      ],
    };
  } catch (error) {
    return {
      success: false,
      errors: [
        `Markdown parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
    };
  }
}

// Detect file format from content
export function detectFileFormat(content: string): "json" | "markdown" | "unknown" {
  const trimmed = content.trim();

  // Check if it's JSON
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // Not valid JSON
    }
  }

  // Check if it's Markdown (contains markdown headers and tables)
  if (
    trimmed.includes("# Architecture Diagram") ||
    (trimmed.includes("## Nodes") && trimmed.includes("## Connections"))
  ) {
    return "markdown";
  }

  return "unknown";
}

// Main import function with auto-detection
export function importDiagram(content: string, options: Partial<ImportOptions> = {}): ImportResult {
  const defaultOptions: ImportOptions = {
    mode: "replace",
    includeViewport: true,
    ...options,
  };

  // Auto-detect format
  const format = detectFileFormat(content);

  if (format === "unknown") {
    return {
      success: false,
      errors: ["Unknown file format. Expected JSON or Markdown."],
    };
  }

  // Parse based on format
  let result: ImportResult;
  if (format === "json") {
    result = parseJSON(content);
  } else {
    result = parseMarkdown(content);
  }

  // Remove viewport if not requested
  if (result.success && result.data && !defaultOptions.includeViewport) {
    delete result.data.viewport;
  }

  return result;
}
