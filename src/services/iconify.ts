/**
 * Iconify API Service
 * Wrapper for the Iconify Search API to find and browse icons
 */

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

/**
 * Search for icons matching a query
 * @param query - Search term (e.g., "database", "docker")
 * @param collection - Optional collection filter (e.g., "mdi", "logos")
 * @param limit - Maximum number of results (default: 48)
 */
export async function searchIcons(
  query: string,
  collection?: string,
  limit: number = 48,
): Promise<IconifySearchResult> {
  try {
    const params = new URLSearchParams({
      query,
      limit: limit.toString(),
    });

    // Limit dynamically loaded icons to the ISC-licensed Lucide collection.
    if (collection && collection !== "lucide") {
      return { icons: [], total: 0 };
    }
    params.append("prefix", "lucide");

    const response = await fetch(`${ICONIFY_API_BASE}/search?${params}`);

    if (!response.ok) {
      throw new Error(`Iconify API error: ${response.status}`);
    }

    return iconifySearchResponseSchema.parse(await response.json());
  } catch (error) {
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

    // Convert object to array and sort by popularity (total icons)
    return Object.entries(data)
      .map(([prefix, collection]) => iconifyCollectionSchema.parse({ ...collection, prefix }))
      .filter((item) => item.prefix === "lucide");
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
  return ["lucide"];
}
