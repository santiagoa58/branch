import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { TECHNOLOGY_ICON_GROUPS } from "@/constants/technologyIcons";
import {
  ALLOWED_ICON_COLLECTIONS,
  getCollections,
  getFeaturedCollections,
  getIconDisplayName,
  normalizeIconSearchQuery,
  searchIcons,
  searchTechnologyIcons,
} from "./iconify";

const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  fetcher.mockReset();
  vi.stubGlobal("fetch", fetcher);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function respond(data: unknown) {
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify(data)));
}

function requestedUrl() {
  const input = fetcher.mock.calls[0]?.[0];
  if (typeof input !== "string") {
    throw new TypeError("Expected an Iconify URL string");
  }
  return new URL(input);
}

describe("Iconify collections", () => {
  it("features exactly the curated brand and symbol collections without exposing mutable state", () => {
    const expected = [
      "logos",
      "simple-icons",
      "devicon",
      "skill-icons",
      "lucide",
      "solar",
      "ph",
      "iconamoon",
    ];
    expect(ALLOWED_ICON_COLLECTIONS).toEqual(expected);
    expect(getFeaturedCollections()).toEqual(expected);
    getFeaturedCollections().pop();
    expect(getFeaturedCollections()).toEqual(expected);
  });

  it("validates collection metadata, filters other sets, and keeps curated order", async () => {
    respond({
      mdi: { name: "Material Design Icons", total: 100 },
      lucide: { name: "Lucide", total: 50 },
      logos: {
        name: "SVG Logos",
        total: 25,
        license: { title: "CC0", spdx: "CC0-1.0" },
      },
      devicon: { name: "Devicon", total: 75 },
    });
    const collections = await getCollections();
    expect(requestedUrl().pathname).toBe("/collections");
    expect(collections.map((collection) => collection.prefix)).toEqual([
      "logos",
      "devicon",
      "lucide",
    ]);
    expect(collections[0]?.license?.spdx).toBe("CC0-1.0");
  });

  it.each([
    null,
    [],
    { logos: { name: "Logos", total: "25" } },
    { logos: { total: 25 } },
    { logos: { name: "Logos", total: -1 } },
    { logos: { name: "Logos", total: 25, license: { title: 1 } } },
  ])("rejects malformed collection responses: %j", async (data) => {
    respond(data);
    await expect(getCollections()).rejects.toThrow("Failed to fetch icon collections");
  });
});

describe("Iconify search", () => {
  it("restricts unfiltered searches with the prefixes allowlist and encodes queries", async () => {
    respond({ icons: ["logos:react", "lucide:server"], total: 200 });
    await expect(searchIcons("React & server")).resolves.toEqual({
      icons: ["logos:react", "lucide:server"],
      total: 200,
    });
    const params = requestedUrl().searchParams;
    expect(params.get("query")).toBe("React & server");
    expect(params.get("prefixes")).toBe(ALLOWED_ICON_COLLECTIONS.join(","));
    expect(params.has("prefix")).toBe(false);
    expect(params.get("limit")).toBe("48");
  });

  it.each(ALLOWED_ICON_COLLECTIONS)("supports the %s collection filter", async (prefix) => {
    respond({ icons: [`${prefix}:test`], total: 1 });
    await expect(searchIcons("test", prefix, 24)).resolves.toEqual({
      icons: [`${prefix}:test`],
      total: 1,
    });
    const params = requestedUrl().searchParams;
    expect(params.get("prefix")).toBe(prefix);
    expect(params.has("prefixes")).toBe(false);
    expect(params.get("limit")).toBe("24");
  });

  it.each(["mdi", "", "logos,lucide", "LOGOS", "logos:react"])(
    "does not fetch unsupported collections (%s), except the empty all-collections filter",
    async (prefix) => {
      if (prefix === "") {
        respond({ icons: [], total: 0 });
      }
      await expect(searchIcons("test", prefix)).resolves.toEqual({ icons: [], total: 0 });
      expect(fetcher).toHaveBeenCalledTimes(prefix === "" ? 1 : 0);
    },
  );

  it("filters unexpected prefixes and malformed IDs returned by the API", async () => {
    respond({
      icons: ["logos:react", "mdi:react", "lucide:server", "logos:", "logos:react:extra", "react"],
      total: 500,
    });
    await expect(searchIcons("react")).resolves.toEqual({
      icons: ["logos:react", "lucide:server"],
      total: 2,
    });
  });

  it("also enforces the selected prefix on returned icons", async () => {
    respond({ icons: ["logos:react", "lucide:server", "mdi:react"], total: 3 });
    await expect(searchIcons("react", "logos")).resolves.toEqual({
      icons: ["logos:react"],
      total: 1,
    });
  });

  it.each([
    {},
    { icons: "logos:react", total: 1 },
    { icons: [123], total: 1 },
    { icons: [], total: "1" },
    { icons: [], total: -1 },
    { icons: [], total: 1.5 },
  ])("rejects malformed search responses: %j", async (data) => {
    respond(data);
    await expect(searchIcons("react")).rejects.toThrow("Failed to search icons");
  });

  it("forwards cancellation without wrapping or logging the abort", async () => {
    const controller = new AbortController();
    const abort = new DOMException("Aborted", "AbortError");
    fetcher.mockImplementationOnce(async () => {
      controller.abort();
      throw abort;
    });
    await expect(searchIcons("react", undefined, 48, controller.signal)).rejects.toBe(abort);
    expect(fetcher.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("surfaces HTTP errors for search and collections", async () => {
    fetcher.mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(searchIcons("react")).rejects.toThrow("Failed to search icons");
    fetcher.mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(getCollections()).rejects.toThrow("Failed to fetch icon collections");
  });

  it("surfaces network failures", async () => {
    fetcher.mockRejectedValueOnce(new TypeError("Offline"));
    await expect(searchIcons("react")).rejects.toThrow("internet connection");
  });
});

describe("plain language icon search", () => {
  it.each([
    ["Postgres", "logos:postgresql", "postgresql"],
    ["Node.js", "logos:nodejs-icon", "nodejs"],
    ["node js", "logos:nodejs-icon", "nodejs"],
    ["Amazon Web Services", "logos:aws", "aws"],
    ["AWS", "logos:aws", "aws"],
    ["GCP", "logos:google-cloud", "googlecloud"],
  ])("matches %s locally and translates it for catalog search", (query, id, apiQuery) => {
    expect(
      searchTechnologyIcons(query).flatMap((group) => group.icons.map((icon) => icon.id)),
    ).toContain(id);
    expect(normalizeIconSearchQuery(query)).toBe(apiQuery);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("browses all groups for empty searches and matches categories and ID syntax locally", () => {
    expect(searchTechnologyIcons("  ")).toEqual(TECHNOLOGY_ICON_GROUPS);
    expect(searchTechnologyIcons("frontend")).toEqual([TECHNOLOGY_ICON_GROUPS[0]]);
    expect(searchTechnologyIcons("logos:postgresql")[0]?.icons[0]?.name).toBe("PostgreSQL");
    expect(searchTechnologyIcons("unknown technology")).toEqual([]);
    expect(normalizeIconSearchQuery("  network server  ")).toBe("network server");
    expect(normalizeIconSearchQuery("lucide:server")).toBe("lucide:server");
  });

  it.each([
    ["logos:nodejs-icon", "Node.js"],
    ["devicon:postgresql-plain", "PostgreSQL"],
    ["simple-icons:amazonwebservices", "AWS"],
    ["logos:aws", "AWS"],
    ["solar:database-bold-duotone", "Database"],
    ["lucide:network-server", "Network Server"],
  ])("labels %s as %s without surfacing its raw ID", (id, name) => {
    expect(getIconDisplayName(id)).toBe(name);
  });
});

describe("featured technology catalog", () => {
  it("contains at least 60 unique, labeled icons across the architecture categories", () => {
    expect(TECHNOLOGY_ICON_GROUPS.map((group) => group.name)).toEqual([
      "Frontend",
      "Backend",
      "Cloud and infrastructure",
      "Data and messaging",
      "AI and machine learning",
    ]);
    const icons = TECHNOLOGY_ICON_GROUPS.flatMap((group) => group.icons);
    expect(icons.length).toBeGreaterThanOrEqual(60);
    expect(new Set(icons.map((icon) => icon.id)).size).toBe(icons.length);
    for (const group of TECHNOLOGY_ICON_GROUPS) {
      expect(group.icons.length).toBeGreaterThan(0);
      for (const icon of group.icons) {
        expect(icon.name.trim()).not.toBe("");
        expect(icon.id).toMatch(/^[a-z0-9-]+:[a-z0-9-]+$/);
        expect(ALLOWED_ICON_COLLECTIONS).toContain(icon.id.split(":")[0]);
      }
    }
  });

  it("includes recognizable frontend, backend, cloud, data, and AI brands", () => {
    const ids = TECHNOLOGY_ICON_GROUPS.flatMap((group) => group.icons.map((icon) => icon.id));
    expect(ids).toEqual(
      expect.arrayContaining([
        "logos:react",
        "logos:nodejs-icon",
        "logos:aws",
        "logos:postgresql",
        "logos:openai-icon",
      ]),
    );
  });
});
