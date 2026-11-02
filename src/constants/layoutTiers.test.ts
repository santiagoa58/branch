import { describe, expect, it } from "vite-plus/test";
import { architectureNodeTypeSchema } from "@/schemas/catalogEnums";
import { NODE_TYPES_CONFIG } from "./index";
import { NODE_CATEGORIES } from "./nodeCategories";
import {
  CLIENT_TIER,
  LAYOUT_TIERS,
  LAYOUT_TIER_LABELS,
  NODE_TIERS,
  tierIndex,
} from "./layoutTiers";

describe("layout tiers", () => {
  it("assigns every node type in the catalog exactly one known tier", () => {
    const types = architectureNodeTypeSchema.options;
    expect(Object.keys(NODE_TIERS).sort()).toEqual([...types].sort());
    expect(Object.keys(NODE_TIERS).sort()).toEqual(Object.keys(NODE_TYPES_CONFIG).sort());
    for (const type of types) {
      expect(LAYOUT_TIERS).toContain(NODE_TIERS[type]);
    }
  });

  it("orders the tiers left to right and labels each one", () => {
    expect(LAYOUT_TIERS).toEqual(["clients", "edge", "services", "async", "data"]);
    expect(LAYOUT_TIERS.map(tierIndex)).toEqual([0, 1, 2, 3, 4]);
    expect(LAYOUT_TIERS.map((tier) => LAYOUT_TIER_LABELS[tier])).toEqual([
      "Clients",
      "Edge",
      "Services",
      "Async",
      "Data",
    ]);
    expect(CLIENT_TIER).toBe("clients");
  });

  it("keeps everything that runs on the device on the client side, and nothing else", () => {
    const deviceCategories = new Set(["clients", "frontend"]);
    const misplaced = NODE_CATEGORIES.flatMap((category) =>
      category.types
        .filter((type) => (NODE_TIERS[type] === CLIENT_TIER) !== deviceCategories.has(category.id))
        .map((type) => `${category.id}/${type}`),
    );
    expect(misplaced).toEqual([]);
  });

  it("places the familiar building blocks in the zones people expect", () => {
    expect(NODE_TIERS).toMatchObject({
      webapp: "clients",
      mobileapp: "clients",
      sdk: "clients",
      clientstorage: "clients",
      cdn: "edge",
      dns: "edge",
      firewall: "edge",
      loadbalancer: "edge",
      gateway: "edge",
      service: "services",
      auth: "services",
      queue: "async",
      eventbus: "async",
      worker: "async",
      database: "data",
      cache: "data",
      storage: "data",
      search: "data",
    });
  });
});
