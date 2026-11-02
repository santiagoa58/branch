import { useDiagramStore } from "@/store/diagramStore";
import { useAiDesignStore } from "@/store/aiDesignStore";
import type { DesignTabId } from "@/store/uiStore";
import { ApiTab } from "./ApiTab";
import { BriefTab } from "./BriefTab";
import { DataModelTab } from "./DataModelTab";
import { DesignTab } from "./DesignTab";
import { RunNotes, RunProgress, UpdateBar } from "./UpdateBar";

/** Content-only design sections; the editor owns the one shared sidebar and navigation. */
export function DesignPanel({ tab }: { tab: DesignTabId }) {
  const brief = useDiagramStore((state) => state.brief);
  const running = useAiDesignStore((state) => state.running);
  const content = () => {
    switch (tab) {
      case "brief":
        return <BriefTab />;
      case "design":
        return <DesignTab />;
      case "api":
        return <ApiTab />;
      case "dataModel":
        return <DataModelTab />;
    }
  };
  // Keep the design and API readable during a run; its progress and Cancel live in Brief.
  if (running && tab === "brief") {
    return <RunProgress />;
  }
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{content()}</div>
      {brief && !running && (
        <>
          <RunNotes />
          <UpdateBar />
        </>
      )}
    </>
  );
}
