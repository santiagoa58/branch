import type { ArchitectureEdgeData } from "@/types";

/**
 * The text of a connection's label pill: its label, else its HTTP method, else its protocol,
 * marked when asynchronous and followed by the request contract's schema name. Shared by the edge
 * renderer and auto-layout, which reserves room for the pill between columns.
 */
export function edgeLabelText(data: ArchitectureEdgeData | undefined): string | undefined {
  const protocol = data?.protocol?.toUpperCase();
  let text = data?.label || data?.method || protocol;
  if (data?.async) {
    text = text ? `${text} (async)` : "(async)";
  }
  const schemaName = data?.dataContract?.schemaName;
  if (schemaName) {
    text = `${text || protocol || "DATA"} • ${schemaName}`;
  }
  return text;
}
