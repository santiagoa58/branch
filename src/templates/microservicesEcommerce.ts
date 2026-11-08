import type { DiagramData } from "@/types";
import { archEdge, archNode, groupNode } from "./builders";
import { attachDecisions } from "./define";
import { decide } from "./reasoning";
import type { DiagramTemplate } from "./types";

const decisions = {
  cluster: decide(
    "One cluster for all services",
    "Services share infrastructure but deploy independently.",
    ["Shared tooling and monitoring"],
    ["A cluster outage affects every service"],
    [["Separate clusters per service", "Overhead for a small team"]],
    ["Teams need separate blast radiuses"],
  ),
  storefront: decide(
    "React storefront with request IDs",
    "Checkout submissions carry a stable ID so retries don't create duplicate orders.",
    ["Safe retries on flaky networks"],
    ["Client must store the ID until confirmed"],
    [["Disable the button after click", "Doesn't help network retries"]],
    ["Checkout moves to a hosted page"],
  ),
  gateway: decide(
    "API gateway",
    "One entry point handles auth and routes to services.",
    ["Clients see one API"],
    ["A shared point of failure"],
    [["Clients call services directly", "Exposes internal services"]],
    ["Only one client ever calls the API"],
  ),
  auth: decide(
    "Central token verification",
    "Every request is checked once before reaching services.",
    ["Consistent auth rules"],
    ["Services still check their own permissions"],
    [["Each service validates tokens", "Duplicated and inconsistent logic"]],
    ["Services need very different auth rules"],
  ),
  orders: decide(
    "Go orders service owning checkout",
    "One service owns the order lifecycle and its compensation steps.",
    ["Checkout rules in one place"],
    ["Coordinates payments and inventory"],
    [["Gateway orchestrates checkout", "Business logic in the gateway"]],
    ["Checkout spans many more services"],
  ),
  payments: decide(
    "Payments service",
    "Payment calls and retries are isolated behind one service.",
    ["Provider details stay hidden"],
    ["Another network hop in checkout"],
    [["Orders calls the provider", "Payment logic spreads into orders"]],
    ["A second payment provider is never added"],
  ),
  "orders-db": decide(
    "Order and outbox in one transaction",
    "An order and its event commit together, so events are never lost.",
    ["No lost or phantom events"],
    ["A relay must publish the outbox"],
    [["Write then publish", "A crash between steps loses events"]],
    ["The broker supports transactional writes"],
  ),
  events: decide(
    "RabbitMQ durable queues",
    "Inventory and notifications react to orders without slowing checkout.",
    ["Checkout doesn't wait on consumers"],
    ["Consumers must handle duplicates"],
    [["Direct calls from orders", "One slow service delays checkout"]],
    ["Event volume needs replay and retention"],
  ),
  inventory: decide(
    "Inventory service",
    "Stock levels have their own rules and update after orders commit.",
    ["Stock logic in one place"],
    ["Stock updates lag orders slightly"],
    [["Orders updates stock", "Mixes two domains in one service"]],
    ["Overselling during the lag becomes a problem"],
  ),
  "notify-svc": decide(
    "Async notification service",
    "Order emails shouldn't slow down or fail checkout.",
    ["Checkout unaffected by email issues"],
    ["Emails can arrive late"],
    [["Send email in checkout", "Provider outages fail orders"]],
    ["Notifications need delivery receipts"],
  ),
  psp: decide(
    "Stripe through an idempotent adapter",
    "Card handling stays with the provider, behind one adapter.",
    ["No card data on our servers"],
    ["Provider fees and outages"],
    [["In-house card processing", "Heavy compliance work"]],
    ["Volume justifies a second provider"],
  ),
};

const data = {
  nodes: attachDecisions(
    "microservices-ecommerce",
    [
      archNode("storefront", "client", "Storefront", 0, 320),
      archNode("gateway", "gateway", "API Gateway", 230, 320),
      groupNode("cluster", "cluster", "Services Cluster", 470, 40, 740, 600),
      archNode("auth", "auth", "Auth Service", 40, 60, { parentId: "cluster" }),
      archNode("events", "queue", "RabbitMQ", 300, 60, {
        parentId: "cluster",
        attributes: [{ name: "Illustrative dead-letter threshold", value: "5", unit: "attempts" }],
      }),
      archNode("notify-svc", "notification", "Notifications", 560, 60, { parentId: "cluster" }),
      archNode("orders", "service", "Orders Service", 40, 250, {
        parentId: "cluster",
      }),
      archNode("payments", "service", "Payments Service", 300, 250, {
        parentId: "cluster",
      }),
      archNode("orders-db", "database", "Orders DB", 560, 250, {
        parentId: "cluster",
      }),
      archNode("inventory", "service", "Inventory Service", 40, 440, { parentId: "cluster" }),
      archNode("psp", "external", "Payment Provider", 1260, 330),
    ],
    decisions,
  ),
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
    archEdge("e-orders-payments", "orders", "payments", {
      protocol: "grpc",
      latencyMs: 15,
      description: "Illustrative simulation delay in ms; not a production measurement.",
    }),
    archEdge("e-payments-psp", "payments", "psp", {
      protocol: "http",
      method: "POST",
      latencyMs: 250,
      description: "Illustrative simulation delay in ms; not a production measurement.",
      decision: decide(
        "Retry with the same idempotency key",
        "A timeout doesn't prove the provider failed to charge.",
        ["Retries can't double-charge"],
        ["Unknown outcomes need a status lookup"],
        [["Retry with a new request", "Risks charging twice"]],
        ["The provider offers exactly-once callbacks"],
      ),
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
