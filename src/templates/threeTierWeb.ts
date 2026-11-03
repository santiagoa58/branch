import type { DiagramData } from "@/types";
import { archEdge, archNode, groupNode } from "./builders";
import { attachDecisions } from "./define";
import { decide } from "./reasoning";
import type { DiagramTemplate } from "./types";

const decisions = {
  vpc: decide(
    "One VPC for the whole app",
    "A classic app needs only one private network with a public load balancer.",
    ["Simple networking to start with"],
    ["Little isolation between tiers"],
    [["Separate networks per tier", "Overhead a starter app rarely needs"]],
    ["Compliance requires isolating the database"],
  ),
  client: decide(
    "React in the browser",
    "Interactive pages update without full reloads.",
    ["Smooth navigation"],
    ["JavaScript bundle to keep small"],
    [["Server-rendered HTML only", "Every click reloads the page"]],
    ["Pages are mostly static content"],
  ),
  cdn: decide(
    "CloudFront for static assets",
    "Scripts, styles and images are the same for everyone and cache well.",
    ["Fast asset loads", "Less load on web servers"],
    ["Deploys must version asset file names"],
    [["Serve assets from web servers", "Slower and wastes server capacity"]],
    ["Assets become personalized"],
  ),
  lb: decide(
    "Load balancer in front of web servers",
    "Traffic is spread across instances, and unhealthy ones are taken out.",
    ["Zero-downtime deploys", "Survives an instance failure"],
    ["Another component to configure"],
    [["Single web server", "Any restart is downtime"]],
    ["Traffic fits on one server with no uptime needs"],
  ),
  web: decide(
    "Next.js web frontend",
    "Rendering pages separately from the API keeps each tier simple.",
    ["Fast first page loads"],
    ["Two services to deploy"],
    [["API renders pages too", "Mixes UI and domain code"]],
    ["The team is too small for two services"],
  ),
  api: decide(
    "Stateless Node.js API",
    "Any instance can serve any request, so scaling means adding instances.",
    ["Easy horizontal scaling"],
    ["Sessions and state must live elsewhere"],
    [["Sticky sessions with in-memory state", "Instance restarts drop sessions"]],
    ["Work becomes CPU-heavy"],
  ),
  cache: decide(
    "Redis cache-aside for hot reads",
    "Repeated lookups skip the database, while writes always go to it.",
    ["Fewer database reads"],
    ["Cached data can be briefly stale"],
    [["Database only", "Repeated queries load the primary"]],
    ["Data must always be current"],
  ),
  db: decide(
    "PostgreSQL as the source of truth",
    "App records are relational and need constraints and transactions.",
    ["Reliable, consistent data"],
    ["One write primary limits scale"],
    [["Document database", "Relations move into application code"]],
    ["Writes outgrow one primary"],
  ),
};

const data = {
  nodes: attachDecisions(
    "three-tier-web",
    [
      archNode("client", "client", "Browser", 0, 250),
      archNode("cdn", "cdn", "CDN", 230, 120),
      groupNode("vpc", "vpc", "App VPC", 470, 60, 660, 440),
      archNode("lb", "loadbalancer", "Load Balancer", 40, 170, { parentId: "vpc" }),
      archNode("web", "service", "Web Frontend", 250, 60, {
        parentId: "vpc",
      }),
      archNode("api", "service", "API Server", 250, 290, {
        parentId: "vpc",
      }),
      archNode("cache", "cache", "Redis", 470, 60, {
        parentId: "vpc",
        attributes: [{ name: "Illustrative lookup TTL", value: "60", unit: "s" }],
      }),
      archNode("db", "database", "PostgreSQL", 470, 290, {
        parentId: "vpc",
      }),
    ],
    decisions,
  ),
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
    archEdge("e-api-cache", "api", "cache", {
      protocol: "redis",
      latencyMs: 2,
      description: "Illustrative simulation delay in ms; not a production measurement.",
      decision: decide(
        "Treat cache errors as misses",
        "Losing Redis shouldn't make the app unavailable.",
        ["App keeps working without the cache"],
        ["A cache outage shifts all reads to PostgreSQL"],
        [["Fail requests when Redis is down", "Cache outages become app outages"]],
        ["PostgreSQL can't absorb full read load"],
      ),
    }),
    archEdge("e-api-db", "api", "db", {
      protocol: "sql",
      latencyMs: 8,
      description: "Illustrative simulation delay in ms; not a production measurement.",
    }),
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
  category: "web",
  inspiredBy: "Basecamp",
  keywords: [
    "web app",
    "monolith",
    "rails",
    "django",
    "crud",
    "postgres",
    "redis",
    "load balancer",
    "starter",
  ],
  highlights: ["VPC group", "Data contract", "Saved flow"],
  data,
};
