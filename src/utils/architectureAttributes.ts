import type { ArchitectureAttribute, ArchitectureNodeData } from "@/types";

/** Explicit attributes win over legacy metadata, without inferring units from freeform values. */
export function getNodeAttributes(
  data: Pick<ArchitectureNodeData, "attributes" | "metadata">,
): ArchitectureAttribute[] {
  const attributes = (data.attributes ?? []).map((attribute) => ({ ...attribute }));
  const names = new Set(attributes.map((attribute) => attribute.name.trim().toLowerCase()));

  for (const [name, value] of Object.entries(data.metadata ?? {})) {
    const normalizedName = name.trim().toLowerCase();
    if (!names.has(normalizedName)) {
      attributes.push({ name, value });
      names.add(normalizedName);
    }
  }

  return attributes;
}

export function formatArchitectureAttribute(attribute: ArchitectureAttribute): string {
  return attribute.unit ? `${attribute.value} ${attribute.unit}` : attribute.value;
}
