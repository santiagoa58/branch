import { XMarkIcon } from "@heroicons/react/24/outline";
import { GROUP_SHORTCUTS, QUICK_ADD_SHORTCUTS } from "@/utils/editorShortcuts";

interface ShortcutsHelpProps {
  onClose: () => void;
}

const nodeSections = [...new Set(QUICK_ADD_SHORTCUTS.map((shortcut) => shortcut.section))];

export function ShortcutsHelp({ onClose }: ShortcutsHelpProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Keyboard shortcuts
        </h2>
        <button
          type="button"
          aria-label="Close keyboard shortcuts"
          onClick={onClose}
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6 overflow-y-auto max-h-[calc(80vh-4rem)]">
        <p className="mb-6 text-sm text-muted-foreground">
          Use ⌘ on macOS or Ctrl on Windows and Linux. Canvas shortcuts pause while you type or use
          a dialog.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Section title="Navigation">
            <Shortcut keys={["V"]} description="Select mode" />
            <Shortcut keys={["H"]} description="Pan/Hand mode" />
            <Shortcut keys={["`"]} description="Laser pointer" />
            <Shortcut keys={["["]} description="Toggle left panel" />
            <Shortcut keys={["]"]} description="Toggle right panel" />
            <Shortcut keys={["?"]} description="Show shortcuts" />
            <Shortcut keys={["Esc"]} description="Close editor overlay or clear selection" />
          </Section>
          {nodeSections.map((section) => (
            <Section key={section} title={section}>
              {QUICK_ADD_SHORTCUTS.filter((shortcut) => shortcut.section === section).map(
                (shortcut) => (
                  <Shortcut
                    key={shortcut.key}
                    keys={[shortcut.key.toUpperCase()]}
                    description={`Add ${shortcut.label}`}
                  />
                ),
              )}
            </Section>
          ))}
          <Section title="Quick Add Groups">
            {GROUP_SHORTCUTS.map((shortcut) => (
              <Shortcut
                key={shortcut.key}
                keys={shortcut.key.split("+")}
                description={`Add ${shortcut.label}`}
              />
            ))}
          </Section>
          <Section title="Editing">
            <Shortcut keys={["Ctrl/⌘", "C"]} description="Copy selected" />
            <Shortcut keys={["Ctrl/⌘", "V"]} description="Paste" />
            <Shortcut keys={["Ctrl/⌘", "D"]} description="Duplicate" />
            <Shortcut keys={["Delete / Backspace"]} description="Delete selected" />
            <Shortcut keys={["Ctrl/⌘", "Z"]} description="Undo" />
            <Shortcut keys={["Ctrl/⌘", "Shift", "Z"]} description="Redo" />
            <Shortcut keys={["Ctrl/⌘", "Y"]} description="Redo (alternate)" />
          </Section>
          <Section title="Selection">
            <Shortcut keys={["Shift", "Click"]} description="Multi-select" />
            <Shortcut keys={["Drag"]} description="Box select" />
            <Shortcut keys={["Ctrl/⌘", "A"]} description="Select all visible nodes" />
            <Shortcut keys={["Ctrl/⌘", "K"]} description="Spotlight search" />
          </Section>
          <Section title="Layout and simulation">
            <Shortcut keys={["Ctrl/⌘", "L"]} description="Auto format" />
            <Shortcut keys={["Shift", "S"]} description="Toggle simulation panel" />
          </Section>
          <Section title="Connections">
            <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-sky-400 dark:bg-sky-500 border-2 border-white dark:border-zinc-800" />
                <span>Input handles (Top, Left)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-400 dark:bg-amber-500 border-2 border-white dark:border-zinc-800" />
                <span>Output handles (Bottom, Right)</span>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
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
