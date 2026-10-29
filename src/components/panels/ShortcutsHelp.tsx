import { XMarkIcon } from "@heroicons/react/24/outline";

interface ShortcutsHelpProps {
  onClose: () => void;
}

export function ShortcutsHelp({ onClose }: ShortcutsHelpProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Keyboard Shortcuts
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6 overflow-y-auto max-h-[calc(80vh-4rem)]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Navigation */}
          <Section title="Navigation">
            <Shortcut keys={["V"]} description="Select mode" />
            <Shortcut keys={["H"]} description="Pan/Hand mode" />
            <Shortcut keys={["`"]} description="Laser pointer" />
            <Shortcut keys={["["]} description="Toggle left panel" />
            <Shortcut keys={["]"]} description="Toggle right panel" />
            <Shortcut keys={["?"]} description="Show shortcuts" />
          </Section>

          {/* Quick Add Nodes */}
          <Section title="Quick Add Nodes">
            <Shortcut keys={["S"]} description="Add Service" />
            <Shortcut keys={["D"]} description="Add Database" />
            <Shortcut keys={["Q"]} description="Add Queue" />
            <Shortcut keys={["C"]} description="Add Cache" />
            <Shortcut keys={["G"]} description="Add Gateway" />
            <Shortcut keys={["E"]} description="Add External" />
            <Shortcut keys={["T"]} description="Add Storage" />
            <Shortcut keys={["L"]} description="Add Client" />
            <Shortcut keys={["N"]} description="Add Comment" />
          </Section>

          {/* Quick Add Cloud Nodes */}
          <Section title="Cloud Infrastructure">
            <Shortcut keys={["F"]} description="Add Lambda" />
            <Shortcut keys={["B"]} description="Add Load Balancer" />
            <Shortcut keys={["Y"]} description="Add CDN" />
            <Shortcut keys={["A"]} description="Add Auth Provider" />
            <Shortcut keys={["P"]} description="Add Container" />
            <Shortcut keys={["Z"]} description="Add DNS" />
          </Section>

          {/* Quick Add AI/ML Nodes */}
          <Section title="AI/ML">
            <Shortcut keys={["M"]} description="Add LLM" />
            <Shortcut keys={["X"]} description="Add Vector DB" />
            <Shortcut keys={["W"]} description="Add ML Pipeline" />
            <Shortcut keys={["I"]} description="Add Embedding" />
          </Section>

          {/* Quick Add Cloud Services */}
          <Section title="Cloud Services">
            <Shortcut keys={["K"]} description="Add Secrets" />
            <Shortcut keys={["U"]} description="Add Event Bus" />
            <Shortcut keys={["J"]} description="Add Data Lake" />
            <Shortcut keys={["R"]} description="Add Search" />
            <Shortcut keys={["O"]} description="Add Notification" />
          </Section>

          {/* Quick Add Groups */}
          <Section title="Quick Add Groups">
            <Shortcut keys={["Shift", "V"]} description="Add VPC" />
            <Shortcut keys={["Shift", "K"]} description="Add Cluster" />
            <Shortcut keys={["Shift", "R"]} description="Add Region" />
            <Shortcut keys={["Shift", "N"]} description="Add Subnet" />
          </Section>

          {/* Editing */}
          <Section title="Editing">
            <Shortcut keys={["⌘", "C"]} description="Copy selected" />
            <Shortcut keys={["⌘", "V"]} description="Paste" />
            <Shortcut keys={["⌘", "D"]} description="Duplicate" />
            <Shortcut keys={["Delete"]} description="Delete selected" />
            <Shortcut keys={["⌘", "Z"]} description="Undo" />
            <Shortcut keys={["⌘", "Y"]} description="Redo" />
          </Section>

          {/* Selection */}
          <Section title="Selection">
            <Shortcut keys={["Shift", "Click"]} description="Multi-select" />
            <Shortcut keys={["Drag"]} description="Box select" />
            <Shortcut keys={["⌘", "K"]} description="Spotlight search" />
          </Section>

          {/* Layout */}
          <Section title="Layout">
            <Shortcut keys={["⌘", "L"]} description="Auto-layout" />
          </Section>

          {/* Connections */}
          <Section title="Connections">
            <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-sky-400 dark:bg-sky-500 border-2 border-white dark:border-zinc-800"></span>
                <span>Input handles (Top, Left)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-400 dark:bg-amber-500 border-2 border-white dark:border-zinc-800"></span>
                <span>Output handles (Bottom, Right)</span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-500 pt-1">
                Drag from output to input to create connections. Protocol auto-selects based on
                target node type.
              </p>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Shortcut({ keys, description }: { keys: string[]; description: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-zinc-600 dark:text-zinc-400">{description}</span>
      <div className="flex gap-1">
        {keys.map((key) => (
          <kbd
            key={`${description}-${key}`}
            className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded text-xs font-mono text-zinc-900 dark:text-zinc-100"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}
