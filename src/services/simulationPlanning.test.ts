import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useSimulationStore } from "@/store/simulationStore";
import { SimulationLimitError } from "@/utils/trafficSimulation";
import { notify, type NotifyOptions } from "./notify";
import { planSimulation } from "./simulationPlanning";

vi.mock("./notify", () => ({ notify: { warning: vi.fn<(options: NotifyOptions) => string>() } }));

beforeEach(() => {
  useSimulationStore.getState().reset();
  useSimulationStore.getState().setMode("traffic");
  useSimulationStore.getState().resume();
  vi.clearAllMocks();
});

describe("simulation planning limits", () => {
  it("pauses excessive fan-out and explains that the model could not be run", () => {
    const result = planSimulation(() => {
      throw new SimulationLimitError();
    });
    expect(result).toBeNull();
    expect(useSimulationStore.getState().isRunning).toBe(false);
    expect(useSimulationStore.getState().stats).toBeNull();
    const warning = vi.mocked(notify.warning).mock.calls[0]?.[0];
    expect(warning?.title).toBe("Simulation paused");
    expect(warning?.message).toContain("branches");
  });

  it("does not hide unexpected programming errors", () => {
    expect(() =>
      planSimulation(() => {
        throw new TypeError("unexpected");
      }),
    ).toThrow("unexpected");
    expect(useSimulationStore.getState().isRunning).toBe(true);
  });
});
