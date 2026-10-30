import { DiagramData } from "@/types";
import { archEdge, archNode, groupNode } from "./builders";
import type { DiagramTemplate } from "./types";

const data = {
  nodes: [
    archNode("storefront", "client", "Storefront", 0, 320, {
      technology: "React",
      tags: ["checkout"],
    }),
    archNode("gateway", "gateway", "API Gateway", 230, 320, { tags: ["checkout"] }),
    groupNode("cluster", "cluster", "Services Cluster", 470, 40, 740, 600),
    archNode("auth", "auth", "Auth Service", 40, 60, { parentId: "cluster" }),
    archNode("events", "queue", "RabbitMQ", 300, 60, {
      parentId: "cluster",
      technology: "RabbitMQ",
    }),
    archNode("notify-svc", "notification", "Notifications", 560, 60, { parentId: "cluster" }),
    archNode("orders", "service", "Orders Service", 40, 250, {
      parentId: "cluster",
      technology: "Go",
      tags: ["checkout"],
    }),
    archNode("payments", "service", "Payments Service", 300, 250, {
      parentId: "cluster",
      tags: ["checkout"],
    }),
    archNode("orders-db", "database", "Orders DB", 560, 250, { parentId: "cluster" }),
    archNode("inventory", "service", "Inventory Service", 40, 440, { parentId: "cluster" }),
    archNode("psp", "external", "Payment Provider", 1260, 330, {
      technology: "Stripe",
      tags: ["checkout"],
    }),
  ],
  edges: [
    archEdge("e-store-gw", "storefront", "gateway", { protocol: "http" }),
    archEdge("e-gw-auth", "gateway", "auth", { protocol: "oauth", label: "verify token" }),
    archEdge("e-gw-orders", "gateway", "orders", {
      protocol: "http",
      method: "POST",
      dataContract: {
        format: "json",
        schemaName: "OrderRequest",
        schema:
          '{\n  "items": [{ "sku": "string", "qty": "number" }],\n  "customerId": "string"\n}',
        description: "Create-order payload",
      },
    }),
    archEdge("e-orders-payments", "orders", "payments", { protocol: "grpc", latencyMs: 15 }),
    archEdge("e-payments-psp", "payments", "psp", {
      protocol: "http",
      method: "POST",
      latencyMs: 250,
    }),
    archEdge("e-orders-db", "orders", "orders-db", { protocol: "sql" }),
    archEdge("e-orders-events", "orders", "events", {
      protocol: "rabbitmq",
      async: true,
      label: "order.created",
    }),
    archEdge("e-events-inventory", "events", "inventory", { protocol: "rabbitmq", async: true }),
    archEdge("e-events-notify", "events", "notify-svc", { protocol: "rabbitmq", async: true }),
  ],
  flows: [
    {
      id: "flow-checkout",
      name: "Checkout",
      description: "An order placed from the storefront, fanning out through the event bus.",
      sourceNodeId: "storefront",
      color: "#8b5cf6",
      speed: 1 as const,
      createdAt: "2026-06-10T00:00:00.000Z",
    },
  ],
} as DiagramData;

export const microservicesEcommerce: DiagramTemplate = {
  id: "microservices-ecommerce",
  name: "Microservices e-commerce",
  description:
    "An order flow across services: gateway with auth, synchronous payment call to an external provider, and async fan-out via RabbitMQ.",
  category: "commerce",
  inspiredBy: "Amazon",
  keywords: [
    "amazon",
    "ebay",
    "online store",
    "orders",
    "microservices",
    "rabbitmq",
    "saga",
    "inventory",
  ],
  highlights: ["Async messaging", "External provider", "Data contract"],
  data,
};
