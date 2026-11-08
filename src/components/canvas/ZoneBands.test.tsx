import { afterEach, describe, expect, it } from "vite-plus/test";
import { cleanup, render, screen } from "@testing-library/react";
import { ReactFlowProvider, type Node } from "@xyflow/react";
import { archNode, groupNode } from "@/templates/builders";
import { collaborativeDocsDesign } from "@/utils/layout/layoutFixtures";
import { autoLayoutDiagram } from "@/utils/layout";
import { zoneBands } from "@/utils/layout/zones";
import type { ArchitectureNodeType } from "@/types";
import { ZoneBands } from "./ZoneBands";

afterEach(cleanup);

function at(id: string, type: ArchitectureNodeType, x: number, y = 0, extra: Partial<Node> = {}) {
  return { ...archNode(id, type, id, x, y), measured: { width: 180, height: 120 }, ...extra };
}

function mount(nodes: Node[]) {
  return render(
    <ReactFlowProvider initialNodes={nodes}>
      <ZoneBands />
    </ReactFlowProvider>,
  );
}

describe("zoneBands", () => {
  it("draws one band per zone with components, left to right, meeting halfway", () => {
    const zones = zoneBands([
      at("app", "webapp", 0),
      at("gateway", "gateway", 300),
      at("api", "service", 600),
      at("db", "database", 900, 200),
    ])!;
    expect(zones.bands.map((band) => [band.zone, band.label])).toEqual([
      ["clients", "Clients"],
      ["edge", "Edge"],
      ["services", "Services"],
      ["data", "Data"],
    ]);
    const [clients, edge, services, data] = zones.bands as [
      (typeof zones.bands)[number],
      (typeof zones.bands)[number],
      (typeof zones.bands)[number],
      (typeof zones.bands)[number],
    ];
    expect(clients.x).toBe(-40);
    expect(clients.x + clients.width).toBe(edge.x);
    expect(edge.x).toBe(240);
    expect(services.x + services.width).toBe(data.x);
    expect(data.x + data.width).toBe(1120);
    expect(zones.divider).toBe(240);
    expect(zones.top).toBeLessThan(0);
    expect(zones.top + zones.height).toBe(360);
  });

  it("skips empty zones and needs at least two to draw anything", () => {
    expect(zoneBands([at("api", "service", 0), at("db", "database", 400)])!.bands).toHaveLength(2);
    expect(
      zoneBands([at("api", "service", 0), at("db", "database", 400)])!.divider,
    ).toBeUndefined();
    expect(zoneBands([at("a", "service", 0), at("b", "service", 400)])).toBeNull();
    expect(zoneBands([])).toBeNull();
    expect(
      zoneBands([
        at("api", "service", 0),
        { id: "note", type: "comment", position: { x: 900, y: 0 }, data: {} },
      ]),
    ).toBeNull();
  });

  it("falls back to the client/server split when server zones interleave", () => {
    const zones = zoneBands([
      at("app", "webapp", 0),
      at("db", "database", 300),
      at("api", "service", 600),
    ])!;
    expect(zones.bands.map((band) => band.label)).toEqual(["Clients", "Server"]);
    expect(zones.divider).toBe(240);
    expect(
      zoneBands([at("api", "service", 0), at("app", "webapp", 300), at("db", "database", 600)]),
    ).toBeNull();
  });

  it("follows children into groups and lets a collapsed group stand for its hidden children", () => {
    const nodes: Node[] = [
      at("app", "webapp", 0),
      {
        ...groupNode("vpc", "vpc", "VPC", 300, 0, 600, 300),
        data: { label: "VPC", groupType: "vpc", collapsed: true },
      },
      at("api", "service", 32, 56, { parentId: "vpc", hidden: true }),
    ];
    const zones = zoneBands(nodes)!;
    expect(zones.bands.map((band) => band.zone)).toEqual(["clients", "services"]);
    // The collapsed card (240 wide) stands in for the hidden service.
    expect(zones.bands[1]!.x + zones.bands[1]!.width).toBe(300 + 240 + 40);
  });

  it("matches the zones of an auto-formatted design", async () => {
    const { nodes, edges } = collaborativeDocsDesign();
    const result = await autoLayoutDiagram(nodes, edges);
    expect(zoneBands(result.nodes)!.bands.map((band) => band.label)).toEqual([
      "Clients",
      "Edge",
      "Services",
      "Async",
      "Data",
    ]);
  });
});

describe("ZoneBands", () => {
  it("renders a labeled band for each zone present and the client/server divider", () => {
    mount([at("app", "webapp", 0), at("gateway", "gateway", 300), at("db", "database", 600)]);
    const layer = screen.getByTestId("zone-bands");
    expect(
      [...layer.querySelectorAll("[data-zone]")].map((band) => band.getAttribute("data-zone")),
    ).toEqual(["clients", "edge", "data"]);
    expect(layer).toHaveTextContent("CLIENTS");
    expect(layer).toHaveTextContent("EDGE");
    expect(layer).toHaveTextContent("DATA");
    expect(layer).not.toHaveTextContent("SERVICES");
    expect(layer).not.toHaveTextContent("ASYNC");
    expect(screen.getByTestId("client-server-divider")).toHaveTextContent("Client sideServer side");
    expect(layer.querySelector("rect")).toHaveAttribute("fill", "var(--zone-band)");
  });

  it("renders no divider without clients and nothing when zones do not apply", () => {
    mount([at("api", "service", 0), at("db", "database", 300)]);
    expect(screen.getByTestId("zone-bands")).toHaveTextContent("SERVICES");
    expect(screen.queryByTestId("client-server-divider")).not.toBeInTheDocument();
    cleanup();
    mount([at("api", "service", 0)]);
    expect(screen.queryByTestId("zone-bands")).not.toBeInTheDocument();
  });
});
