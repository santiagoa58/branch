import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { ElkNode } from "elkjs/lib/elk-api";
import type { LayoutBox } from "./elk";

const worker = vi.hoisted(() => ({
  created: vi.fn<(options: { workerUrl: string }) => void>(),
  layout: vi.fn<(graph: ElkNode) => Promise<ElkNode>>(),
  terminate: vi.fn<() => void>(),
}));

vi.mock("elkjs/lib/elk-api.js", () => ({
  default: class MockElk {
    constructor(options: { workerUrl: string }) {
      worker.created(options);
    }
    layout(graph: ElkNode): Promise<ElkNode> {
      return worker.layout(graph);
    }
    terminateWorker(): void {
      worker.terminate();
    }
  },
}));

const boxes: LayoutBox[] = [
  { id: "client", width: 180, height: 140, tier: 0 },
  { id: "server", width: 180, height: 140, tier: 2 },
];

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal("Worker", vi.fn<() => void>());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("browser ELK worker", () => {
  it("uses the Vite-emitted worker asset instead of the blocking bundled engine", async () => {
    worker.layout.mockImplementation(async (graph) => ({
      ...graph,
      children: (graph.children ?? []).map((child, index) => ({
        ...child,
        x: index * 250,
        y: 0,
      })),
    }));
    const { layoutSiblings } = await import("./elk");
    const result = await layoutSiblings(boxes, [], true);
    expect(worker.created).toHaveBeenCalledOnce();
    expect(worker.created.mock.calls[0]?.[0].workerUrl).toMatch(/elk-worker/);
    expect(worker.layout).toHaveBeenCalledOnce();
    expect(result.positions.get("client")).toEqual({ x: 0, y: 0 });
    expect(result.positions.get("server")).toEqual({ x: 250, y: 0 });
  });

  it("rejects a stalled worker and terminates it rather than loading forever", async () => {
    worker.layout.mockImplementation(() => new Promise<ElkNode>(() => {}));
    const { layoutSiblings } = await import("./elk");
    vi.useFakeTimers();
    const pending = layoutSiblings(boxes, [], true);
    const settled = pending.then(
      () => "resolved",
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(12_001);
    expect(worker.layout).toHaveBeenCalledOnce();
    expect(await settled).toMatchObject({ message: expect.stringMatching(/layout timed out/i) });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
