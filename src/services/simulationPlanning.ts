import { useSimulationStore } from "@/store/simulationStore";
import { SimulationLimitError } from "@/utils/trafficSimulation";
import { notify } from "./notify";

/** Keep rejected plans out of playback and counters without disguising programming errors. */
export function planSimulation<T>(plan: () => T): T | null {
  try {
    return plan();
  } catch (error) {
    if (!(error instanceof SimulationLimitError)) {
      throw error;
    }
    const store = useSimulationStore.getState();
    store.pause();
    store.setStats(null);
    notify.warning({ title: "Simulation paused", message: error.message });
    return null;
  }
}
