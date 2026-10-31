import { describe, expect, it } from "vite-plus/test";
import type { Edge, Node } from "@xyflow/react";
import type { ArchitectureNodeType, EdgeProtocol } from "@/types";
import { findIngressBypasses } from "./designRules";

function node(id: string, type: ArchitectureNodeType): Node {
  return { id, type: "architecture", position: { x: 0, y: 0 }, data: { label: id, type } };
}

function edge(source: string, target: string, protocol: EdgeProtocol = "http"): Edge {
  return { id: `${source}-${target}`, source, target, data: { protocol } };
}

const nodes = [
  node("browser", "webapp"),
  node("phone", "mobileapp"),
  node("partner", "external"),
  node("gateway", "gateway"),
  node("lb", "loadbalancer"),
  node("auth", "auth"),
  node("bucket", "storage"),
  node("api", "service"),
  node("db", "database"),
  node("sfu", "server"),
  { id: "vpc", type: "group", position: { x: 0, y: 0 }, data: { label: "vpc", groupType: "vpc" } },
];

describe("findIngressBypasses", () => {
  it("flags outside actors that call internal components directly", () => {
    expect(
      findIngressBypasses(nodes, [
        edge("browser", "api"),
        edge("phone", "db", "sql"),
        edge("partner", "api"),
      ]),
    ).toEqual([
      { edgeId: "browser-api", source: "browser", target: "api" },
      { edgeId: "phone-db", source: "phone", target: "db" },
      { edgeId: "partner-api", source: "partner", target: "api" },
    ]);
  });

  it("allows entry points, sign-in, presigned uploads and calls to third parties", () => {
    expect(
      findIngressBypasses(nodes, [
        edge("browser", "gateway"),
        edge("phone", "lb", "websocket"),
        edge("browser", "auth", "oauth"),
        edge("phone", "bucket", "s3"),
        edge("browser", "partner"),
        edge("gateway", "api"),
        edge("api", "browser", "websocket"),
      ]),
    ).toEqual([]);
  });

  it("allows real-time media and game traffic straight to an assigned server", () => {
    expect(
      findIngressBypasses(nodes, [edge("phone", "sfu", "webrtc"), edge("browser", "sfu", "udp")]),
    ).toEqual([]);
    expect(findIngressBypasses(nodes, [edge("phone", "sfu", "tcp")])).toHaveLength(1);
  });

  it("ignores groups and edges whose endpoints are missing", () => {
    expect(
      findIngressBypasses(nodes, [edge("browser", "vpc"), edge("browser", "missing")]),
    ).toEqual([]);
  });
});
