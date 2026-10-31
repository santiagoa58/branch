import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { useDiagramStore } from "@/store/diagramStore";
import { useSimulationStore } from "@/store/simulationStore";
import { TrafficLog } from "./TrafficLog";

beforeEach(() => {
  useDiagramStore.setState({
    ...useDiagramStore.getInitialState(),
    nodes: [
      {
        id: "app",
        type: "architecture",
        position: { x: 0, y: 0 },
        data: { label: "Mobile app", type: "mobileapp" },
      },
      {
        id: "db",
        type: "architecture",
        position: { x: 0, y: 0 },
        data: { label: "Orders DB", type: "database" },
      },
      {
        id: "worker",
        type: "architecture",
        position: { x: 0, y: 0 },
        data: { label: "Mailer", type: "worker" },
      },
    ],
  });
  useSimulationStore.getState().reset();
});

afterEach(cleanup);

describe("TrafficLog", () => {
  it("explains how to start when nothing has finished yet", () => {
    render(<TrafficLog />);
    expect(screen.getByRole("region", { name: "Request log" })).toHaveTextContent(
      "Click a component to take it down",
    );
  });

  it("describes each outcome in plain language with counts and success rate", () => {
    const store = useSimulationStore.getState();
    store.recordTraffic({
      id: "r1",
      kind: "request",
      sourceId: "app",
      outcome: "ok",
      latencyMs: 42,
      waitingCount: 0,
    });
    store.recordTraffic({
      id: "r2",
      kind: "request",
      sourceId: "app",
      outcome: "failed",
      failedAt: "db",
      latencyMs: 30,
      waitingCount: 0,
    });
    store.recordTraffic({
      id: "r3",
      kind: "request",
      sourceId: "app",
      outcome: "waiting",
      latencyMs: 50,
      waitingCount: 2,
    });
    store.recordTraffic({
      id: "r3:q",
      kind: "delivery",
      sourceId: "worker",
      outcome: "delivered",
      latencyMs: 12,
      waitingCount: 0,
    });
    render(<TrafficLog />);

    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "DeliveredMessage delivered to Mailer after recovery12 ms",
      "WaitingMobile app request succeeded; 2 messages waiting50 ms",
      "FailedMobile app request failed at Orders DB (down)30 ms",
      "OKMobile app request succeeded42 ms",
    ]);
    const stat = (term: string) =>
      screen.getByText(term, { selector: "dt" }).nextElementSibling?.textContent;
    expect(stat("Sent")).toBe("3");
    expect(stat("OK")).toBe("67%");
    expect(stat("Failed")).toBe("1");
    expect(stat("Delivered")).toBe("1");
  });
});
