import type { ApiOutput, ComponentsOutput, DesignContext } from "../../../src/schemas/aiDesign";

// A fixed 40-component design, the size of a large realistic result. It has no model behind it: it
// feeds the stage 3 to 5 prompts when no live stage 2 output exists, and it sizes the largest
// stage input for AI_MAX_BODY_BYTES (see synthetic.test.ts).

export const syntheticContext: DesignContext = {
  prompt:
    "Design a ride-hailing platform with rider and driver apps, matching, payments and analytics.",
  scope: "fullstack",
  requirements: [
    {
      kind: "functional",
      text: "Riders request a ride and see the driver approach",
      assumed: false,
    },
    { kind: "functional", text: "Drivers receive and accept ride offers", assumed: false },
    { kind: "functional", text: "Riders pay at the end of the trip", assumed: false },
    {
      kind: "nonFunctional",
      text: "Driver locations update every 4 seconds for 500,000 drivers",
      assumed: false,
      category: "scale",
    },
    {
      kind: "nonFunctional",
      text: "A rider is matched within 5 seconds",
      assumed: true,
      category: "latency",
    },
    {
      kind: "nonFunctional",
      text: "Payments are never charged twice",
      assumed: true,
      category: "consistency",
    },
  ],
  outOfScope: ["Driver onboarding", "Fleet management"],
};

const SERVICES = [
  "identity",
  "profile",
  "rides",
  "matching",
  "pricing",
  "payments",
  "payouts",
  "notifications",
  "ratings",
  "support",
  "analytics",
  "fraud",
  "search",
  "reviews",
  "promotions",
  "scheduling",
] as const;

/** 40 components: 4 clients, 16 services with a database each, and 4 shared infrastructure parts. */
export function syntheticComponents(): ComponentsOutput {
  const label = (key: string) => key.charAt(0).toUpperCase() + key.slice(1);
  const clients = [
    { key: "rider-app", type: "mobileapp", label: "Rider app" },
    { key: "driver-app", type: "mobileapp", label: "Driver app" },
    { key: "admin-console", type: "webapp", label: "Admin console" },
    { key: "marketing-site", type: "webapp", label: "Marketing site" },
  ] as const;
  const shared = [
    { key: "gateway", type: "gateway", label: "API gateway" },
    { key: "event-bus", type: "eventbus", label: "Event bus" },
    { key: "location-cache", type: "cache", label: "Location cache" },
    { key: "object-store", type: "storage", label: "Object storage" },
  ] as const;
  const components: ComponentsOutput["components"] = [
    ...clients.map((client) => ({
      ...client,
      responsibility: `${client.label} lets people use the platform from their device`,
    })),
    ...shared.map((part) => ({
      ...part,
      responsibility: `${part.label} serves every service that needs it`,
    })),
    ...SERVICES.flatMap((name) => [
      {
        key: `${name}-service`,
        type: "service" as const,
        label: `${label(name)} service`,
        responsibility: `Owns ${name} rules and exposes them to other components`,
      },
      {
        key: `${name}-db`,
        type: "database" as const,
        label: `${label(name)} database`,
        responsibility: `Stores ${name} records durably`,
      },
    ]),
  ];
  const connections: ComponentsOutput["connections"] = [
    ...["rider-app", "driver-app", "admin-console", "marketing-site"].map((from) => ({
      from,
      to: "gateway",
      protocol: "http" as const,
      purpose: "Calls the platform API",
      async: false,
    })),
    ...SERVICES.flatMap((name) => [
      {
        from: "gateway",
        to: `${name}-service`,
        protocol: "grpc" as const,
        purpose: `Routes ${name} requests`,
        async: false,
      },
      {
        from: `${name}-service`,
        to: `${name}-db`,
        protocol: "sql" as const,
        purpose: `Reads and writes ${name} records`,
        async: false,
      },
      {
        from: `${name}-service`,
        to: "event-bus",
        protocol: "kafka" as const,
        purpose: `Publishes ${name} events`,
        async: true,
      },
    ]),
    {
      from: "matching-service",
      to: "location-cache",
      protocol: "redis",
      purpose: "Reads driver positions",
      async: false,
    },
    {
      from: "support-service",
      to: "object-store",
      protocol: "s3",
      purpose: "Stores attachments",
      async: false,
    },
  ];
  return {
    summary:
      "Rider and driver apps call an API gateway that routes to sixteen domain services, each owning its database. Services publish events to a shared bus; matching reads driver positions from a cache so a match never waits on a database.",
    groups: [],
    components,
    connections,
    mainFlow: {
      name: "Request a ride",
      description: "The rider app asks for a ride; matching offers it to nearby drivers.",
      entry: "rider-app",
    },
  };
}

/** Two endpoints per service, which with the graph is the largest stage 5 input. */
export function syntheticApi(): ApiOutput {
  return {
    endpoints: SERVICES.flatMap((name) =>
      (["GET", "POST"] as const).map((method) => ({
        key: `${method.toLowerCase()}-${name}`,
        service: `${name}-service`,
        calledBy: ["rider-app", "driver-app"],
        method,
        path: `/${name}`,
        summary: `${method === "GET" ? "Reads" : "Changes"} ${name} data`,
        auth: "user" as const,
        style: "request" as const,
        errors: [{ status: 404, when: `The ${name} record does not exist` }],
      })),
    ),
    events: [],
  };
}
