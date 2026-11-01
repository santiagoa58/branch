import { toPng, toSvg } from "html-to-image";
import { jsPDF } from "jspdf";
import type { ArchitectureAttribute, DesignDecision, DiagramData } from "@/types";
import { architectureNodeDataSchema, groupNodeDataSchema } from "@/schemas/diagram";
import { NODE_TYPES_CONFIG, GROUP_TYPES_CONFIG } from "@/constants";
import type { Node } from "@xyflow/react";
import { SCHEMA_VERSION } from "./import";
import { getNodeAttributes } from "./architectureAttributes";
import { getDecisionRows } from "./designDecision";

export interface ExportOptions {
  includeViewport?: boolean;
  includeComments?: boolean;
  includeMetadata?: boolean;
  prettyPrint?: boolean;
}

interface VersionedDiagramData extends DiagramData {
  version?: string;
  exportedAt?: string;
  metadata?: {
    appName: string;
    appVersion: string;
  };
}

export interface ExportStats {
  nodeCount: number;
  edgeCount: number;
  groupCount: number;
}

// Get the React Flow viewport element
function getReactFlowElement(): HTMLElement | null {
  return document.querySelector(".react-flow__viewport");
}

// Get export statistics
export function getExportStats(data: DiagramData): ExportStats {
  const nodeCount = data.nodes.filter((n) => n.type !== "group" && n.type !== "comment").length;
  const groupCount = data.nodes.filter((n) => n.type === "group").length;
  const edgeCount = data.edges.length;

  return {
    nodeCount,
    edgeCount,
    groupCount,
  };
}

// Generate PNG preview (returns data URL instead of downloading)
export async function generatePreviewPng(backgroundColor: string, scale = 2): Promise<string> {
  const reactFlowContainer = document.querySelector(".react-flow");
  if (!reactFlowContainer) {
    throw new Error("React Flow container not found");
  }

  const dataUrl = await toPng(reactFlowContainer as HTMLElement, {
    backgroundColor,
    pixelRatio: scale,
    filter: (node: HTMLElement) => {
      // Filter out selection indicators and nodesselection elements
      if (node.classList) {
        return (
          !node.classList.contains("react-flow__nodesselection") &&
          !node.classList.contains("react-flow__selectionpane") &&
          !node.classList.contains("react-flow__selection")
        );
      }
      return true;
    },
  });

  return dataUrl;
}

// Generate SVG preview (returns data URL instead of downloading)
export async function generatePreviewSvg(backgroundColor: string): Promise<string> {
  const reactFlowContainer = document.querySelector(".react-flow");
  if (!reactFlowContainer) {
    throw new Error("React Flow container not found");
  }

  const dataUrl = await toSvg(reactFlowContainer as HTMLElement, {
    backgroundColor,
    filter: (node: HTMLElement) => {
      // Filter out selection indicators and nodesselection elements
      if (node.classList) {
        return (
          !node.classList.contains("react-flow__nodesselection") &&
          !node.classList.contains("react-flow__selectionpane") &&
          !node.classList.contains("react-flow__selection")
        );
      }
      return true;
    },
  });

  return dataUrl;
}

// Get bounding box of selected nodes
function getSelectedNodesBounds(
  selectedNodes: Node[],
): { x: number; y: number; width: number; height: number } | null {
  if (selectedNodes.length === 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  selectedNodes.forEach((node) => {
    const nodeWidth = (node.style?.width as number) || node.measured?.width || 150;
    const nodeHeight = (node.style?.height as number) || node.measured?.height || 100;

    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + nodeWidth);
    maxY = Math.max(maxY, node.position.y + nodeHeight);
  });

  const padding = 40;
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

// Export selected nodes as SVG
export async function exportSelectedAsSvg(selectedNodes: Node[]): Promise<void> {
  if (selectedNodes.length === 0) {
    throw new Error("No nodes selected");
  }

  const reactFlowContainer = document.querySelector(".react-flow__viewport") as HTMLElement;
  if (!reactFlowContainer) {
    throw new Error("React Flow viewport not found");
  }

  const bounds = getSelectedNodesBounds(selectedNodes);
  if (!bounds) {
    throw new Error("Could not calculate bounds");
  }

  const dataUrl = await toSvg(reactFlowContainer, {
    backgroundColor: "#ffffff",
    width: bounds.width,
    height: bounds.height,
    style: {
      transform: `translate(${-bounds.x}px, ${-bounds.y}px)`,
    },
  });

  // Download
  const link = document.createElement("a");
  link.download = `architecture-selection-${Date.now()}.svg`;
  link.href = dataUrl;
  link.click();
}

// Export selected nodes as PNG
export async function exportSelectedAsPng(selectedNodes: Node[]): Promise<void> {
  if (selectedNodes.length === 0) {
    throw new Error("No nodes selected");
  }

  const reactFlowContainer = document.querySelector(".react-flow__viewport") as HTMLElement;
  if (!reactFlowContainer) {
    throw new Error("React Flow viewport not found");
  }

  const bounds = getSelectedNodesBounds(selectedNodes);
  if (!bounds) {
    throw new Error("Could not calculate bounds");
  }

  const dataUrl = await toPng(reactFlowContainer, {
    backgroundColor: "#ffffff",
    width: bounds.width,
    height: bounds.height,
    pixelRatio: 2,
    style: {
      transform: `translate(${-bounds.x}px, ${-bounds.y}px)`,
    },
  });

  // Download
  const link = document.createElement("a");
  link.download = `architecture-selection-${Date.now()}.png`;
  link.href = dataUrl;
  link.click();
}

// Export as PNG
export async function exportAsPng(backgroundColor = "#09090b", scale = 2): Promise<void> {
  const element = getReactFlowElement();
  if (!element) {
    throw new Error("Diagram element not found");
  }

  // Get the bounds of all nodes
  const reactFlowContainer = document.querySelector(".react-flow");
  if (!reactFlowContainer) {
    throw new Error("React Flow container not found");
  }

  const dataUrl = await toPng(reactFlowContainer as HTMLElement, {
    backgroundColor,
    pixelRatio: scale,
    filter: (node: HTMLElement) => {
      // Filter out selection indicators and nodesselection elements
      if (node.classList) {
        return (
          !node.classList.contains("react-flow__nodesselection") &&
          !node.classList.contains("react-flow__selectionpane") &&
          !node.classList.contains("react-flow__selection")
        );
      }
      return true;
    },
  });

  // Download
  const link = document.createElement("a");
  link.download = `branch-diagram-${Date.now()}.png`;
  link.href = dataUrl;
  link.click();
}

// Export as SVG
export async function exportAsSvg(backgroundColor = "#09090b"): Promise<void> {
  const reactFlowContainer = document.querySelector(".react-flow");
  if (!reactFlowContainer) {
    throw new Error("React Flow container not found");
  }

  const dataUrl = await toSvg(reactFlowContainer as HTMLElement, {
    backgroundColor,
    filter: (node: HTMLElement) => {
      // Filter out selection indicators and nodesselection elements
      if (node.classList) {
        return (
          !node.classList.contains("react-flow__nodesselection") &&
          !node.classList.contains("react-flow__selectionpane") &&
          !node.classList.contains("react-flow__selection")
        );
      }
      return true;
    },
  });

  // Download
  const link = document.createElement("a");
  link.download = `branch-diagram-${Date.now()}.svg`;
  link.href = dataUrl;
  link.click();
}

// Export as PDF
export async function exportAsPdf(
  backgroundColor = "#09090b",
  orientation: "portrait" | "landscape" = "landscape",
): Promise<void> {
  const reactFlowContainer = document.querySelector(".react-flow");
  if (!reactFlowContainer) {
    throw new Error("React Flow container not found");
  }

  // First convert to PNG
  const dataUrl = await toPng(reactFlowContainer as HTMLElement, {
    backgroundColor,
    pixelRatio: 2,
    filter: (node: HTMLElement) => {
      // Filter out selection indicators and nodesselection elements
      if (node.classList) {
        return (
          !node.classList.contains("react-flow__nodesselection") &&
          !node.classList.contains("react-flow__selectionpane") &&
          !node.classList.contains("react-flow__selection")
        );
      }
      return true;
    },
  });

  // Create PDF
  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Add title
  pdf.setFontSize(16);
  pdf.setTextColor(255, 255, 255);
  pdf.setFillColor(9, 9, 11); // zinc-950
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  pdf.setTextColor(228, 228, 231); // zinc-200
  pdf.text("Architecture Diagram", 14, 15);

  pdf.setFontSize(10);
  pdf.setTextColor(113, 113, 122); // zinc-500
  pdf.text(`Exported: ${new Date().toLocaleString()}`, 14, 22);

  // Add the diagram image
  const imgWidth = pageWidth - 28;
  const imgHeight = pageHeight - 40;
  pdf.addImage(dataUrl, "PNG", 14, 30, imgWidth, imgHeight);

  // Download
  pdf.save(`branch-diagram-${Date.now()}.pdf`);
}

function markdownCell(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\\`*_[\]|]/g, "\\$&")
    .replace(/\r\n|\r|\n/g, "<br>");
}

function markdownDetails(
  title: string,
  decision?: DesignDecision,
  attributes: ArchitectureAttribute[] = [],
): string {
  const fields = getDecisionRows(decision);

  if (fields.length === 0 && attributes.length === 0) {
    return "";
  }

  let md = `### ${markdownCell(title)}\n\n`;
  if (fields.length > 0) {
    md += "| Decision | Details |\n|----------|---------|\n";
    for (const [name, value] of fields) {
      md += `| ${name} | ${markdownCell(value)} |\n`;
    }
    md += "\n";
  }
  if (attributes.length > 0) {
    md += "| Attribute | Value | Unit |\n|-----------|-------|------|\n";
    for (const attribute of attributes) {
      md += `| ${markdownCell(attribute.name)} | ${markdownCell(attribute.value)} | ${markdownCell(attribute.unit ?? "")} |\n`;
    }
    md += "\n";
  }
  return md;
}

// Export as Markdown
export function exportAsMarkdown(data: DiagramData): void {
  const nodes = data.nodes;
  const edges = data.edges;

  let details = "";
  let md = "# Architecture Diagram\n\n";
  md += `> Generated: ${new Date().toLocaleString()}\n\n`;

  // Group nodes by type
  const groups = nodes.filter((n) => n.type === "group");
  const regularNodes = nodes.filter((node) => node.type === "architecture");

  // Groups section
  if (groups.length > 0) {
    md += "## Infrastructure Groups\n\n";
    md += "| Group | Type | Description |\n";
    md += "|-------|------|-------------|\n";
    groups.forEach((group) => {
      const parsedData = groupNodeDataSchema.safeParse(group.data);
      if (parsedData.success) {
        const groupData = parsedData.data;
        const config = GROUP_TYPES_CONFIG[groupData.groupType];
        md += `| ${markdownCell(groupData.label)} | ${config.label} | ${markdownCell(groupData.description ?? "-")} |\n`;
        details += markdownDetails(`Group: ${groupData.label}`, groupData.decision);
      }
    });
    md += "\n";
  }

  // Components section
  md += "## Components\n\n";
  md += "| Component | Type | Description |\n";
  md += "|-----------|------|-------------|\n";

  regularNodes.forEach((node) => {
    const parsedData = architectureNodeDataSchema.safeParse(node.data);
    if (parsedData.success) {
      const nodeData = parsedData.data;
      const config = NODE_TYPES_CONFIG[nodeData.type];
      md += `| ${markdownCell(nodeData.label)} | ${config.label} | ${markdownCell(nodeData.description ?? "-")} |\n`;
      details += markdownDetails(
        `Component: ${nodeData.label}`,
        nodeData.decision,
        getNodeAttributes(nodeData),
      );
    }
  });

  md += "\n";

  // Connections section
  if (edges.length > 0) {
    md += "## Connections\n\n";
    md += "| Source | Target | Protocol | Method | Description |\n";
    md += "|--------|--------|----------|--------|-------------|\n";

    edges.forEach((edge) => {
      const edgeData = edge.data;
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);
      const sourceLabel = sourceNode?.data["label"];
      const targetLabel = targetNode?.data["label"];
      const sourceName = typeof sourceLabel === "string" ? sourceLabel : edge.source;
      const targetName = typeof targetLabel === "string" ? targetLabel : edge.target;

      md += `| ${markdownCell(sourceName)} | ${markdownCell(targetName)} | ${edgeData?.protocol || "-"} | ${edgeData?.method || "-"} | ${markdownCell(edgeData?.description || "-")} |\n`;
      details += markdownDetails(
        `Connection: ${sourceName} → ${targetName} (${edgeData?.label || edge.id})`,
        edgeData?.decision,
      );
    });

    md += "\n";
  }

  if (details) {
    md += `## Architecture Details\n\n${details}`;
  }

  // Architecture overview (Mermaid diagram)
  md += "## Diagram (Mermaid)\n\n";
  md += "```mermaid\ngraph TD\n";

  // Add nodes
  regularNodes.forEach((node) => {
    const parsedData = architectureNodeDataSchema.safeParse(node.data);
    if (parsedData.success) {
      const nodeData = parsedData.data;
      const shape =
        nodeData.type === "database"
          ? "[(Database)]"
          : nodeData.type === "queue"
            ? "{{Queue}}"
            : nodeData.type === "gateway"
              ? "([Gateway])"
              : `[${nodeData.label}]`;
      const safeId = node.id.replace(/[^a-zA-Z0-9]/g, "_");
      md += `    ${safeId}${shape}\n`;
    }
  });

  // Add edges
  edges.forEach((edge) => {
    const edgeData = edge.data;
    const safeSource = edge.source.replace(/[^a-zA-Z0-9]/g, "_");
    const safeTarget = edge.target.replace(/[^a-zA-Z0-9]/g, "_");
    const label = edgeData?.protocol ? `|${edgeData.protocol}|` : "";
    md += `    ${safeSource} -->${label} ${safeTarget}\n`;
  });

  md += "```\n";

  // Download
  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `branch-diagram-${Date.now()}.md`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

// Export as JSON
export function exportAsJson(data: DiagramData, options: ExportOptions = {}): void {
  const {
    includeViewport = true,
    includeComments = true,
    includeMetadata = true,
    prettyPrint = true,
  } = options;

  // Create versioned data
  const exportData: VersionedDiagramData = { ...data };

  // Add version and metadata
  if (includeMetadata) {
    exportData.version = SCHEMA_VERSION;
    exportData.exportedAt = new Date().toISOString();
    exportData.metadata = {
      appName: "Branch",
      appVersion: "1.0.0",
    };
  }

  // Remove viewport if not requested
  if (!includeViewport) {
    delete exportData.viewport;
  }

  // Filter out comments if not requested
  if (!includeComments) {
    exportData.nodes = exportData.nodes.filter((node) => node.type !== "comment");
  }

  const json = prettyPrint ? JSON.stringify(exportData, null, 2) : JSON.stringify(exportData);

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `branch-diagram-${Date.now()}.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

// A private cloud URL never contains a document snapshot or grants access.
export function generateShareableLink(): string {
  const url = new URL(window.location.href);
  if (!/^\/projects\/[^/]+\/diagrams\/[^/]+\/?$/.test(url.pathname)) {
    throw new Error("Open a cloud diagram before copying its private link.");
  }
  url.search = "";
  url.hash = "";
  return url.toString();
}

export async function copyShareableLink(): Promise<void> {
  await navigator.clipboard.writeText(generateShareableLink());
}
