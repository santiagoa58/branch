import { describe, expect, it } from "vite-plus/test";
import type { Edge, Node } from "@xyflow/react";
import type { ArchitectureNodeType, EdgeProtocol } from "@/types";
import { isAsyncEdge, planRequest, releaseWaiting } from "./trafficSimulation";

function node(id: string, type: ArchitectureNodeType): Node {
  return { id, type: "architecture", position: { x: 0, y: 0 }, data: { label: id, type } };
}

function edge(
  source: string,
  target: string,
  protocol: EdgeProtocol = "http",
  latencyMs = 10,
  extra: Record<string, unknown> = {},
): Edge {
  return { id: `${source}-${target}`, source, target, data: { protocol, latencyMs, ...extra } };
}

const nodes = [
  node("browser", "webapp"),
  node("api", "service"),
  node("db", "database"),
  node("queue", "queue"),
  node("worker", "worker"),
  node("mail", "external"),
];
const shop = [
  edge("browser", "api"),
  edge("api", "db", "sql"),
  edge("api", "queue", "amqp"),
  edge("queue", "worker", "amqp"),
  edge("worker", "mail"),
];
const none = new Set<string>();
const options = { nodes };

describe("isAsyncEdge", () => {
  it("distinguishes one-way messages from synchronous calls", () => {
    expect(isAsyncEdge(edge("a", "b", "amqp"))).toBe(true);
    expect(isAsyncEdge(edge("a", "b", "http", 10, { async: true }))).toBe(true);
    expect(isAsyncEdge(edge("a", "b", "http"))).toBe(false);
    expect(isAsyncEdge(edge("a", "b", "sql"))).toBe(false);
  });
});

describe("planRequest", () => {
  it("returns Redis's branch before unrelated persistence and background work", () => {
    const collabNodes = [
      node("client", "webapp"),
      node("collab", "service"),
      node("redis", "cache"),
      node("db", "database"),
      node("worker", "worker"),
    ];
    const edges = [
      edge("client", "collab", "websocket", 5),
      edge("collab", "redis", "redis", 2),
      edge("collab", "db", "sql", 50),
      edge("collab", "worker", "http", 200, { async: true }),
    ];
    const plan = planRequest(edges, "client", none, "r1", { nodes: collabNodes });
    expect(plan?.hops.find((hop) => hop.from === "redis" && hop.reverse)?.startMs).toBe(7);
    expect(plan?.hops.find((hop) => hop.from === "collab" && hop.reverse)?.startMs).toBe(105);
    expect(plan).toMatchObject({ responseMs: 110, durationMs: 205, outcome: "ok" });
  });

  it("keeps sibling timing independent of the order connections were added", () => {
    const edges = [
      edge("browser", "api"),
      edge("api", "db", "sql", 40),
      edge("api", "mail", "http", 2),
    ];
    for (const ordered of [edges, [...edges].reverse()]) {
      const plan = planRequest(ordered, "browser", none, "r1", options);
      expect(plan?.hops.find((hop) => hop.from === "mail" && hop.reverse)?.startMs).toBe(12);
      expect(plan?.responseMs).toBe(100);
    }
  });

  it("calls a shared dependency separately for each branch", () => {
    const edges = [
      edge("browser", "api"),
      edge("browser", "worker"),
      edge("api", "db", "sql"),
      edge("worker", "db", "sql"),
    ];
    const plan = planRequest(edges, "browser", new Set(["db"]), "r1");
    expect(plan?.hops.filter((hop) => hop.to === "db" && hop.kind === "request")).toHaveLength(2);
    expect(plan?.hops.filter((hop) => hop.to === "browser" && hop.kind === "error")).toHaveLength(
      2,
    );
  });

  it("preserves synchronous read-through cache dependencies", () => {
    const edges = [edge("browser", "cache", "redis", 2), edge("cache", "db", "sql", 20)];
    const plan = planRequest(edges, "browser", new Set(["db"]), "r1", {
      nodes: [...nodes, node("cache", "cache")],
    });
    expect(plan).toMatchObject({ outcome: "failed", failedAt: "db", responseMs: 44 });
  });

  it("acknowledges queue acceptance without waiting for its consumers, even over HTTP", () => {
    const edges = [edge("browser", "queue", "http", 5), edge("queue", "worker", "http", 100)];
    const plan = planRequest(edges, "browser", new Set(["worker"]), "r1", options);
    expect(plan).toMatchObject({ outcome: "ok", responseMs: 10, durationMs: 105 });
    expect(plan?.waiting).toMatchObject([{ from: "queue", to: "worker", blockedBy: "worker" }]);
    expect(plan?.hops.find((hop) => hop.edgeId === "queue-worker")?.kind).toBe("message");
  });

  it("fails an enqueue when the broker is down instead of inventing a sender-side buffer", () => {
    const plan = planRequest(shop, "browser", new Set(["queue"]), "r1", options);
    expect(plan).toMatchObject({ outcome: "failed", failedAt: "queue" });
    expect(plan?.waiting).toEqual([]);
    expect(plan?.hops.find((hop) => hop.edgeId === "api-queue" && hop.reverse)?.kind).toBe("error");
    expect(plan?.hops.some((hop) => hop.from === "queue" && !hop.reverse)).toBe(false);
  });

  it.each(["queue", "stream"] as const)(
    "keeps an accepted %s delivery when consumer processing fails",
    (type) => {
      const plan = planRequest(shop, "browser", new Set(["mail"]), "r1", {
        nodes: nodes.map((item) => (item.id === "queue" ? node("queue", type) : item)),
      });
      expect(plan?.outcome).toBe("ok");
      expect(plan?.waiting).toMatchObject([{ edgeId: "queue-worker", blockedBy: "mail" }]);
    },
  );

  it.each(["websocket", "sse", "http"] as const)(
    "does not retain a failed one-way %s message",
    (protocol) => {
      const plan = planRequest(
        [edge("browser", "worker", protocol, 10, { async: true })],
        "browser",
        new Set(["worker"]),
        "r1",
        options,
      );
      expect(plan).toMatchObject({ outcome: "ok", responseMs: 0, waiting: [] });
    },
  );

  it("does not give event-bus subscriptions durable queue semantics", () => {
    const plan = planRequest(
      [edge("browser", "bus", "sns"), edge("bus", "worker", "sns")],
      "browser",
      new Set(["worker"]),
      "r1",
      { nodes: [...nodes, node("bus", "eventbus")] },
    );
    expect(plan?.waiting).toEqual([]);
  });

  it("does not start from a down entry point", () => {
    expect(planRequest(shop, "browser", new Set(["browser"]), "r1", options)).toBeNull();
  });

  it("stops cycles within each branch", () => {
    const plan = planRequest(
      [edge("browser", "api"), edge("api", "db"), edge("db", "browser")],
      "browser",
      none,
      "r1",
      options,
    );
    expect(plan?.hops.filter((hop) => hop.kind === "request")).toHaveLength(2);
  });

  it("uses role timing for both directions and supports visual duration transforms", () => {
    const graph = [edge("browser", "db", "sql", 0)];
    const plan = planRequest(graph, "browser", none, "r1", {
      nodes,
      durationOf: (latencyMs) => latencyMs + 300,
    });
    expect(plan).toMatchObject({ responseMs: 600, durationMs: 600 });
  });
});

describe("releaseWaiting", () => {
  const waitingForMail = () =>
    planRequest(shop, "browser", new Set(["mail"]), "r1", options)?.waiting ?? [];

  it("keeps accepted messages until their failed dependency recovers", () => {
    const waiting = waitingForMail();
    expect(waiting).toHaveLength(1);
    expect(releaseWaiting(shop, waiting, new Set(["mail"]), options)).toEqual({
      plans: [],
      stillWaiting: waiting,
    });
    const recovered = releaseWaiting(shop, waiting, none, options);
    expect(recovered.stillWaiting).toEqual([]);
    expect(recovered.plans[0]?.hops.map(({ kind, from, to }) => `${kind} ${from}→${to}`)).toEqual([
      "message queue→worker",
      "request worker→mail",
      "response mail→worker",
    ]);
    expect(recovered.plans[0]).toMatchObject({ waiting: [], responseMs: 30 });
  });

  it("keeps a delivery while its owning broker is down", () => {
    const waiting = waitingForMail();
    const result = releaseWaiting(shop, waiting, new Set(["queue"]), options);
    expect(result.plans).toEqual([]);
    expect(result.stillWaiting).toMatchObject([{ from: "queue", blockedBy: "queue" }]);
  });

  it("waits again if a later attempt encounters another failed dependency", () => {
    const waiting = planRequest(shop, "browser", new Set(["worker"]), "r1", options)?.waiting ?? [];
    const result = releaseWaiting(shop, waiting, new Set(["mail"]), options);
    expect(result.stillWaiting).toEqual([]);
    expect(result.plans[0]?.waiting).toMatchObject([{ blockedBy: "mail" }]);
    expect(result.plans[0]?.waiting[0]?.id).toBe(waiting[0]?.id);
  });

  it("drops deliveries when their connection or durable source no longer exists", () => {
    const waiting = waitingForMail();
    expect(releaseWaiting(shop.slice(0, 2), waiting, none, options)).toEqual({
      plans: [],
      stillWaiting: [],
    });
    expect(
      releaseWaiting(shop, waiting, none, { nodes: nodes.filter((item) => item.id !== "queue") }),
    ).toEqual({ plans: [], stillWaiting: [] });
  });
});

function repeatedDiamonds(count: number): Edge[] {
  return Array.from({ length: count }, (_, index) => [
    edge(`join-${index}`, `left-${index}`),
    edge(`join-${index}`, `right-${index}`),
    edge(`left-${index}`, `join-${index + 1}`),
    edge(`right-${index}`, `join-${index + 1}`),
  ]).flat();
}

describe("planning safeguards", () => {
  it("refuses exponential fan-out instead of freezing or returning a partial success", () => {
    expect(() => planRequest(repeatedDiamonds(12), "join-0", none, "large")).toThrow(
      "too many request branches",
    );
  });

  it("applies the same safety bound when a queued delivery is released", () => {
    const edges = [edge("queue", "join-0"), ...repeatedDiamonds(12)];
    expect(() =>
      releaseWaiting(
        edges,
        [
          {
            id: "accepted",
            requestId: "large",
            edgeId: "queue-join-0",
            from: "queue",
            to: "join-0",
            blockedBy: "join-0",
          },
        ],
        none,
        options,
      ),
    ).toThrow("too many request branches");
  });

  it("preserves distinct accepted deliveries through parallel incoming connections and retries", () => {
    const edges = [
      { ...edge("browser", "queue"), id: "publish-one" },
      { ...edge("browser", "queue"), id: "publish-two" },
      edge("queue", "worker"),
      edge("worker", "mail"),
    ];
    const waiting =
      planRequest(edges, "browser", new Set(["worker"]), "parallel", options)?.waiting ?? [];
    expect(waiting).toHaveLength(2);
    expect(new Set(waiting.map((message) => message.id)).size).toBe(2);
    const retried = releaseWaiting(edges, waiting, new Set(["mail"]), options).plans.flatMap(
      (plan) => plan.waiting,
    );
    expect(retried).toHaveLength(2);
    expect(retried.map((message) => message.id)).toEqual(waiting.map((message) => message.id));
  });
});

describe("bounded recovery batches", () => {
  const delivery = (id: string, target = "worker") => ({
    id,
    requestId: `request-${id}`,
    edgeId: `queue-${target}`,
    from: "queue",
    to: target,
    blockedBy: target,
  });

  it("drains a large valid backlog in bounded batches without losing or duplicating deliveries", () => {
    const waiting = Array.from({ length: 1500 }, (_, index) => delivery(`accepted-${index}`));
    let remaining = waiting;
    const delivered: string[] = [];
    while (remaining.length > 0) {
      const batch = releaseWaiting(shop, remaining, none, options);
      expect(batch.plans.length).toBeGreaterThan(0);
      expect(batch.plans.length).toBeLessThanOrEqual(24);
      delivered.push(...batch.plans.map((plan) => plan.id));
      remaining = batch.stillWaiting;
    }
    expect(delivered).toEqual(waiting.map((message) => message.id));
    expect(new Set(delivered).size).toBe(1500);
  });

  it("preserves every pending delivery when no animation slot is available", () => {
    const waiting = [delivery("first"), delivery("second")];
    expect(releaseWaiting(shop, waiting, none, { ...options, maxDeliveries: 0 })).toEqual({
      plans: [],
      stillWaiting: waiting,
    });
  });

  it("defers another individually valid delivery when the batch hop budget is full", () => {
    const graph = [edge("queue", "join-0"), ...repeatedDiamonds(8)];
    const waiting = [
      delivery("first", "join-0"),
      delivery("second", "join-0"),
      delivery("third", "join-0"),
    ];
    const batch = releaseWaiting(graph, waiting, none, options);
    expect(batch.plans.map((plan) => plan.id)).toEqual(["first", "second"]);
    expect(batch.stillWaiting).toEqual([waiting[2]]);
    const finalBatch = releaseWaiting(graph, batch.stillWaiting, none, options);
    expect(finalBatch.plans.map((plan) => plan.id)).toEqual(["third"]);
    expect(finalBatch.stillWaiting).toEqual([]);
  });
});
