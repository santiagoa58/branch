/**
 * Iconify API Service
 * Wrapper for the Iconify Search API to find and browse icons
 */

import { TECHNOLOGY_ICON_GROUPS, type TechnologyIconGroup } from "@/constants/technologyIcons";
import {
  iconifyCollectionSchema,
  iconifyCollectionsResponseSchema,
  iconifySearchResponseSchema,
  type IconifyCollection,
  type IconifySearchResponse,
} from "@/schemas/iconify";

export type IconifySearchResult = IconifySearchResponse;
export type IconifyCollectionsResponse = Record<string, IconifyCollection>;
export type { IconifyCollection };

const ICONIFY_API_BASE = "https://api.iconify.design";
const technologyIcons = TECHNOLOGY_ICON_GROUPS.flatMap((group) => group.icons);

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Local metadata remains searchable even when the Iconify API is unavailable. */
export function searchTechnologyIcons(query: string): readonly TechnologyIconGroup[] {
  const terms = query.trim().split(/\s+/).map(normalizeName).filter(Boolean);
  return TECHNOLOGY_ICON_GROUPS.map((group) => ({
    ...group,
    icons: group.icons.filter((icon) => {
      const text = normalizeName(
        [icon.name, icon.id, group.name, ...(icon.aliases ?? [])].join(" "),
      );
      return terms.every((term) => text.includes(term));
    }),
  })).filter((group) => group.icons.length > 0);
}

/** Translate familiar brand aliases without requiring Iconify search syntax. */
export function normalizeIconSearchQuery(query: string): string {
  const normalized = normalizeName(query);
  const match = technologyIcons.find((icon) =>
    [icon.name, ...(icon.aliases ?? [])].some((name) => normalizeName(name) === normalized),
  );
  return match ? normalizeName(match.name) : query.trim();
}

/** Prefer brand spelling; fall back to readable words for wider catalog results. */
export function getIconDisplayName(iconId: string): string {
  const known = technologyIcons.find((icon) => icon.id === iconId);
  if (known) {
    return known.name;
  }
  const name = (iconId.split(":").pop() ?? iconId).replace(
    /(?:-(?:icon|original|plain|wordmark|line|fill|filled|outline|rounded|sharp|bold|duotone|linear|color|dark|light))+$/,
    "",
  );
  const brand = technologyIcons.find((icon) =>
    [
      icon.name,
      icon.id
        .split(":")
        .pop()
        ?.replace(/-icon$/, "") ?? "",
      ...(icon.aliases ?? []),
    ].some((candidate) => normalizeName(candidate) === normalizeName(name)),
  );
  return (
    brand?.name ?? name.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

export const ALLOWED_ICON_COLLECTIONS: readonly string[] = [
  "logos",
  "simple-icons",
  "devicon",
  "skill-icons",
  "lucide",
  "solar",
  "ph",
  "iconamoon",
];

/**
 * Search for icons matching a query
 * @param query - Search term (e.g., "database", "docker")
 * @param collection - Optional allowlisted collection filter (e.g., "logos")
 * @param limit - Maximum number of results (default: 48)
 */
export async function searchIcons(
  query: string,
  collection?: string,
  limit: number = 48,
  signal?: AbortSignal,
): Promise<IconifySearchResult> {
  try {
    const params = new URLSearchParams({
      query,
      limit: limit.toString(),
    });

    if (collection && !ALLOWED_ICON_COLLECTIONS.includes(collection)) {
      return { icons: [], total: 0 };
    }
    if (collection) {
      params.set("prefix", collection);
    } else {
      params.set("prefixes", ALLOWED_ICON_COLLECTIONS.join(","));
    }

    const response = await fetch(
      `${ICONIFY_API_BASE}/search?${params}`,
      signal ? { signal } : undefined,
    );

    if (!response.ok) {
      throw new Error(`Iconify API error: ${response.status}`);
    }

    const data = iconifySearchResponseSchema.parse(await response.json());
    const allowedPrefixes = collection ? [collection] : ALLOWED_ICON_COLLECTIONS;
    const icons = data.icons.filter((icon) => {
      const [prefix, name, extra] = icon.split(":");
      return allowedPrefixes.includes(prefix ?? "") && !!name && extra === undefined;
    });
    // The API total covers all pages; do not present it as an allowed total if
    // the response ignored our prefix restriction.
    return { icons, total: icons.length === data.icons.length ? data.total : icons.length };
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    console.error("Failed to search icons:", error);
    throw Object.assign(
      new Error("Failed to search icons. Please check your internet connection."),
      {
        cause: error,
      },
    );
  }
}

/**
 * Fetch available icon collections/sets
 */
export async function getCollections(): Promise<IconifyCollection[]> {
  try {
    const response = await fetch(`${ICONIFY_API_BASE}/collections`);

    if (!response.ok) {
      throw new Error(`Iconify API error: ${response.status}`);
    }

    const data = iconifyCollectionsResponseSchema.parse(await response.json());

    // Keep the curated order, with brand collections first.
    return Object.entries(data)
      .map(([prefix, collection]) => iconifyCollectionSchema.parse({ ...collection, prefix }))
      .filter((item) => ALLOWED_ICON_COLLECTIONS.includes(item.prefix))
      .sort(
        (a, b) =>
          ALLOWED_ICON_COLLECTIONS.indexOf(a.prefix) - ALLOWED_ICON_COLLECTIONS.indexOf(b.prefix),
      );
  } catch (error) {
    console.error("Failed to fetch collections:", error);
    throw Object.assign(
      new Error("Failed to fetch icon collections. Please check your internet connection."),
      { cause: error },
    );
  }
}

/**
 * Get popular/featured collections for quick access
 */
export function getFeaturedCollections(): string[] {
  return [...ALLOWED_ICON_COLLECTIONS];
}
