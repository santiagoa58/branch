import { DiagramData } from "@/types";
import { archEdge, archNode, groupNode } from "./builders";
import type { DiagramTemplate } from "./index";

const data = {
  nodes: [
    archNode("client", "client", "Browser", 0, 250, {
      technology: "React SPA",
      tags: ["frontend"],
    }),
    archNode("cdn", "cdn", "CDN", 230, 120, { technology: "CloudFront", tags: ["frontend"] }),
    groupNode("vpc", "vpc", "App VPC", 470, 60, 660, 440),
    archNode("lb", "loadbalancer", "Load Balancer", 40, 170, { parentId: "vpc" }),
    archNode("web", "service", "Web Frontend", 250, 60, {
      parentId: "vpc",
      technology: "Next.js",
      tags: ["frontend"],
    }),
    archNode("api", "service", "API Server", 250, 290, {
      parentId: "vpc",
      technology: "Node.js",
      port: "3000",
      tags: ["backend"],
    }),
    archNode("cache", "cache", "Redis", 470, 60, { parentId: "vpc", tags: ["backend"] }),
    archNode("db", "database", "PostgreSQL", 470, 290, { parentId: "vpc", tags: ["backend"] }),
  ],
  edges: [
    archEdge("e-client-cdn", "client", "cdn", {
      protocol: "http",
      method: "GET",
      label: "static assets",
    }),
    archEdge("e-client-lb", "client", "lb", { protocol: "http", label: "app traffic" }),
    archEdge("e-lb-web", "lb", "web", { protocol: "http" }),
    archEdge("e-web-api", "web", "api", {
      protocol: "http",
      method: "POST",
      dataContract: {
        format: "json",
        schemaName: "ApiRequest",
        schema: '{\n  "action": "string",\n  "payload": {}\n}',
        description: "Frontend → API request envelope",
      },
      responseContract: {
        format: "json",
        schemaName: "ApiResponse",
        schema: '{\n  "ok": "boolean",\n  "data": {}\n}',
      },
    }),
    archEdge("e-api-cache", "api", "cache", { protocol: "redis", latencyMs: 2 }),
    archEdge("e-api-db", "api", "db", { protocol: "sql", latencyMs: 8 }),
  ],
  flows: [
    {
      id: "flow-page-load",
      name: "Page load",
      description: "A user request flowing from the browser down to the database.",
      sourceNodeId: "client",
      color: "#3b82f6",
      speed: 1 as const,
      createdAt: "2026-06-10T00:00:00.000Z",
    },
  ],
} as DiagramData;

export const threeTierWeb: DiagramTemplate = {
  id: "three-tier-web",
  name: "Three-tier web app",
  description:
    "The classic starting point: browser and CDN in front, load-balanced web and API tiers inside a VPC, backed by Postgres and Redis.",
  category: "Web",
  highlights: ["VPC group", "Data contract", "Saved flow"],
  data,
};
