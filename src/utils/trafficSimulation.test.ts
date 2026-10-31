import { describe, expect, it } from "vite-plus/test";
import type { Edge } from "@xyflow/react";
import type { EdgeProtocol } from "@/types";
import { DEFAULT_HOP_MS, isAsyncEdge, planRequest, releaseWaiting } from "./trafficSimulation";

function edge(
  source: string,
  target: string,
  protocol: EdgeProtocol = "http",
  extra: Record<string, unknown> = {},
): Edge {
  return { id: `${source}-${target}`, source, target, data: { protocol, ...extra } };
}

// browser → gateway → api → db, and api hands orders to a queue drained by a worker.
const shop = [
  edge("browser", "gateway", "http", { latencyMs: 20 }),
  edge("gateway", "api", "http", { latencyMs: 10 }),
  edge("api", "db", "sql", { latencyMs: 5 }),
  edge("api", "queue", "amqp"),
  edge("queue", "worker", "amqp"),
  edge("worker", "mail", "http"),
];

const none = new Set<string>();

describe("isAsyncEdge", () => {
  it("treats fire-and-forget protocols and async edges as hand-offs", () => {
    expect(isAsyncEdge(edge("a", "b", "amqp"))).toBe(true);
    expect(isAsyncEdge(edge("a", "b", "http", { async: true }))).toBe(true);
    expect(isAsyncEdge(edge("a", "b", "http"))).toBe(false);
    expect(isAsyncEdge(edge("a", "b", "sql"))).toBe(false);
  });
});

describe("planRequest", () => {
  it("sends calls down and responses back up, each response after its downstream work", () => {
    const plan = planRequest(shop.slice(0, 3), "browser", none, "r1");
    expect(plan?.outcome).toBe("ok");
    expect(
      plan?.hops.map(({ kind, from, to, startMs }) => `${kind} ${from}→${to} @${startMs}`),
    ).toEqual([
      "request browser→gateway @0",
      "request gateway→api @20",
      "request api→db @30",
      "response db→api @35",
      "response api→gateway @40",
      "response gateway→browser @50",
    ]);
    expect(plan?.durationMs).toBe(70);
    expect(plan?.hops.filter((hop) => hop.reverse).every((hop) => hop.kind === "response")).toBe(
      true,
    );
  });

  it("fails a request at the first down component and sends the error back to the caller", () => {
    const plan = planRequest(shop, "browser", new Set(["db"]), "r1");
    expect(plan).toMatchObject({ outcome: "failed", failedAt: "db" });
    const errors = plan?.hops.filter((hop) => hop.kind === "error") ?? [];
    expect(errors.map((hop) => `${hop.kind} ${hop.from}→${hop.to}`)).toEqual([
      "error db→api",
      "error api→gateway",
      "error gateway→browser",
    ]);
    // The independent order hand-off still completes; only the synchronous chain failed.
    expect(plan?.hops.find((hop) => hop.from === "mail")?.kind).toBe("response");
    // The request never travels past the down database.
    expect(plan?.hops.some((hop) => hop.from === "db" && !hop.reverse)).toBe(false);
  });

  it("does not block the caller on a hand-off, and holds the message while the queue is down", () => {
    const plan = planRequest(shop, "browser", new Set(["queue"]), "r1");
    expect(plan?.outcome).toBe("ok");
    expect(plan?.waiting).toEqual([
      {
        id: "r1:api-queue",
        requestId: "r1",
        edgeId: "api-queue",
        from: "api",
        to: "queue",
        blockedBy: "queue",
      },
    ]);
    expect(plan?.hops.find((hop) => hop.edgeId === "api-queue")?.kind).toBe("message");
  });

  it("keeps a message in the queue when its consumer's own call fails", () => {
    const plan = planRequest(shop, "browser", new Set(["mail"]), "r1");
    expect(plan?.outcome).toBe("ok");
    expect(plan?.waiting).toMatchObject([
      { edgeId: "queue-worker", from: "queue", to: "worker", blockedBy: "mail" },
    ]);
  });

  it("does not start a request from a down entry point", () => {
    expect(planRequest(shop, "browser", new Set(["browser"]), "r1")).toBeNull();
  });

  it("uses an illustrative latency for edges without one", () => {
    const plan = planRequest([edge("a", "b")], "a", none, "r1");
    expect(plan?.hops[0]?.durationMs).toBe(DEFAULT_HOP_MS);
    expect(plan?.durationMs).toBe(2 * DEFAULT_HOP_MS);
  });

  it("visits each component once per request, so cycles end", () => {
    const plan = planRequest([edge("a", "b"), edge("b", "c"), edge("c", "a")], "a", none, "r1");
    expect(plan?.hops.filter((hop) => hop.kind === "request")).toHaveLength(2);
  });
});

describe("releaseWaiting", () => {
  it("delivers waiting messages once their blocking component recovers", () => {
    const waiting = planRequest(shop, "browser", new Set(["mail"]), "r1")?.waiting ?? [];
    const stillDown = releaseWaiting(shop, waiting, new Set(["mail"]));
    expect(stillDown).toEqual({ plans: [], stillWaiting: waiting });

    const recovered = releaseWaiting(shop, waiting, none);
    expect(recovered.stillWaiting).toEqual([]);
    expect(recovered.plans).toHaveLength(1);
    expect(recovered.plans[0]?.hops.map(({ kind, from, to }) => `${kind} ${from}→${to}`)).toEqual([
      "message queue→worker",
      "request worker→mail",
      "response mail→worker",
    ]);
    expect(recovered.plans[0]?.waiting).toEqual([]);
  });

  it("waits again behind the next down component", () => {
    const waiting = planRequest(shop, "browser", new Set(["queue", "mail"]), "r1")?.waiting ?? [];
    const { plans, stillWaiting } = releaseWaiting(shop, waiting, new Set(["mail"]));
    expect(stillWaiting).toEqual([]);
    expect(plans[0]?.waiting).toMatchObject([{ edgeId: "queue-worker", blockedBy: "mail" }]);
  });

  it("drops messages whose connection no longer exists", () => {
    const waiting = planRequest(shop, "browser", new Set(["queue"]), "r1")?.waiting ?? [];
    expect(releaseWaiting(shop.slice(0, 3), waiting, none)).toEqual({
      plans: [],
      stillWaiting: [],
    });
  });
});
