import type { ArchitectureEdge, ArchitectureNodeType, DiagramData, DiagramNode } from "@/types";
import {
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

// Parse Markdown export back to diagram data
export function parseMarkdown(markdown: string): ImportResult {
  try {
    const nodes: DiagramNode[] = [];
    const edges: ArchitectureEdge[] = [];

    // Extract components from markdown table
    const componentTableMatch = markdown.match(
      /## Components\n\n\| Component \|.*?\n\|[-\s|]+\n([\s\S]*?)(?=\n##|\n$)/,
    );
    const componentRows = componentTableMatch?.[1];
    if (componentRows) {
      const rows = componentRows.trim().split("\n");
      rows.forEach((row, index) => {
        const columns = row
          .split("|")
          .map((col) => col.trim())
          .filter((col) => col);
        const [label, typeStr, technology, port, description] = columns;
        if (label && typeStr && technology) {
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
            typeMap[normalizedType] ?? normalizedType,
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
              ...(technology !== "-" ? { technology } : {}),
              ...(port && port !== "-" ? { port } : {}),
              ...(description && description !== "-" ? { description } : {}),
            },
          });
        }
      });
    }

    // Create node ID map for edge resolution
    const nodeNameToId = new Map<string, string>();
    nodes.forEach((node) => {
      if (node.data?.label && typeof node.data.label === "string") {
        nodeNameToId.set(node.data.label, node.id);
      }
    });

    // Extract connections from markdown table
    const connectionTableMatch = markdown.match(
      /## Connections\n\n\| Source \|.*?\n\|[-\s|]+\n([\s\S]*?)(?=\n##|\n$)/,
    );
    const connectionRows = connectionTableMatch?.[1];
    if (connectionRows) {
      const rows = connectionRows.trim().split("\n");
      rows.forEach((row, index) => {
        const columns = row
          .split("|")
          .map((col) => col.trim())
          .filter((col) => col);
        const [source, target, protocol, method, description] = columns;
        if (source && target && protocol) {
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
        }
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
      warnings: [`Imported ${nodes.length} nodes and ${edges.length} edges from markdown`],
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
