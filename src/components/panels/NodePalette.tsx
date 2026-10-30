import { useDragEvent } from "@/hooks/useDragEvent";
import { NODE_TYPES_CONFIG, GROUP_TYPES_CONFIG, COMMENT_CONFIG } from "@/constants";
import { NODE_CATEGORIES } from "@/constants/nodeCategories";
import { ArchitectureNodeType, GroupNodeType } from "@/types";
import { cn } from "@/lib/utils";
import {
  MagnifyingGlassIcon,
  UserCircleIcon,
  Squares2X2Icon,
  ChatBubbleBottomCenterTextIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import { useOnboardingStore } from "@/store/onboardingStore";

// Keyboard shortcuts for nodes
const NODE_SHORTCUTS: Partial<Record<ArchitectureNodeType, string>> = {
  service: "S",
  database: "D",
  queue: "Q",
  cache: "C",
  gateway: "G",
  external: "E",
  storage: "T",
  client: "L",
  // Tier 1: Cloud Infrastructure
  lambda: "F",
  loadbalancer: "B",
  cdn: "Y",
  auth: "A",
  container: "P",
  dns: "Z",
  // Tier 2: AI/ML
  llm: "M",
  vectordb: "X",
  mlpipeline: "W",
  embedding: "I",
  // Tier 3: Cloud Services
  secrets: "K",
  eventbus: "U",
  datalake: "J",
  search: "R",
  notification: "O",
};

// Keyboard shortcuts for groups
const GROUP_SHORTCUTS: Partial<Record<GroupNodeType, string>> = {
  vpc: "Shift+V",
  cluster: "Shift+K",
  region: "Shift+R",
  subnet: "Shift+N",
};

// Infrastructure and logical containers
const GROUP_CATEGORIES: GroupNodeType[] = [
  "boundary",
  "view",
  "vpc",
  "cluster",
  "region",
  "subnet",
];

export function NodePalette() {
  const [searchQuery, setSearchQuery] = useState("");
  const onboardingActiveStep = useOnboardingStore((s) => s.activeStep);

  // Filter regular nodes
  const filteredCategories = NODE_CATEGORIES.reduce(
    (acc, { label: category, types }) => {
      const filtered = types.filter((type) => {
        const config = NODE_TYPES_CONFIG[type];
        return [config.label, config.description, type, ...(config.keywords ?? [])]
          .join(" ")
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase());
      });
      if (filtered.length > 0) {
        acc[category] = filtered;
      }
      return acc;
    },
    {} as Record<string, ArchitectureNodeType[]>,
  );

  // Filter groups
  const filteredGroups = GROUP_CATEGORIES.filter((type) => {
    const config = GROUP_TYPES_CONFIG[type];
    return (
      config.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      type.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Filter comments
  const showComments =
    searchQuery === "" ||
    COMMENT_CONFIG.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    COMMENT_CONFIG.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    "comment".includes(searchQuery.toLowerCase()) ||
    "annotation".includes(searchQuery.toLowerCase()) ||
    "note".includes(searchQuery.toLowerCase());

  return (
    <aside
      className={cn(
        "w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col z-20",
        onboardingActiveStep === "add-node" && "onboarding-pulse",
      )}
    >
      {/* Search */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
          <input
            type="text"
            aria-label="Search architecture components"
            placeholder="Search components..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-500 rounded-md pl-8 pr-3 py-2 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-0 transition-colors"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {!showComments &&
          filteredGroups.length === 0 &&
          Object.keys(filteredCategories).length === 0 && (
            <output className="text-sm text-muted-foreground">
              No components match this search. Try a component name or technology.
            </output>
          )}
        {/* Annotations Section */}
        {showComments && (
          <div>
            <h3 className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <ChatBubbleBottomCenterTextIcon className="w-3 h-3" />
              Annotations
            </h3>
            <div className="space-y-2">
              <CommentDraggableNode />
            </div>
          </div>
        )}

        {showComments &&
          (filteredGroups.length > 0 || Object.keys(filteredCategories).length > 0) && (
            <div className="h-px bg-zinc-200 dark:bg-zinc-800 w-full" />
          )}

        {/* Architectural containers */}
        {filteredGroups.length > 0 && (
          <div>
            <h3 className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <Squares2X2Icon className="w-3 h-3" />
              Containers & Boundaries
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {filteredGroups.map((type) => (
                <GroupDraggableNode key={type} type={type} />
              ))}
            </div>
          </div>
        )}

        {filteredGroups.length > 0 && Object.keys(filteredCategories).length > 0 && (
          <div className="h-px bg-zinc-200 dark:bg-zinc-800 w-full" />
        )}

        {/* Regular Node Categories */}
        {Object.entries(filteredCategories).map(([category, types]) => (
          <div key={category}>
            <h3 className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-3">
              {category}
            </h3>
            {category === "Backend & Messaging" ? (
              // Grid layout for compute nodes (more visual prominence)
              <div className="grid grid-cols-2 gap-2">
                {types.map((type) => (
                  <GridDraggableNode key={type} type={type} />
                ))}
              </div>
            ) : category === "External" ? (
              // List layout for external services (detailed descriptions)
              <div className="space-y-2">
                {types.map((type) => (
                  <ListDraggableNode key={type} type={type} />
                ))}
              </div>
            ) : (
              // List layout for data store and messaging
              <div className="space-y-2">
                {types.map((type) => (
                  <ListDraggableNode key={type} type={type} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* User Profile / Footer */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-linear-to-tr from-zinc-300 to-zinc-200 dark:from-zinc-700 dark:to-zinc-600 border border-zinc-300 dark:border-zinc-500 flex items-center justify-center">
            <UserCircleIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-zinc-900 dark:text-zinc-200">User</span>
            <span className="text-[10px] text-muted-foreground">Workspace Owner</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

// Draggable comment component
function CommentDraggableNode() {
  const Icon = COMMENT_CONFIG.icon;
  const { onDragStart } = useDragEvent("comment");

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group cursor-grab active:cursor-grabbing flex items-center gap-3 p-2 rounded-md hover:bg-yellow-50 dark:hover:bg-yellow-950/30 border border-transparent hover:border-yellow-200 dark:hover:border-yellow-800 transition-all relative"
    >
      <span className="p-1.5 rounded bg-yellow-100 dark:bg-yellow-900/30">
        <Icon className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
      </span>
      <div className="flex flex-col flex-1">
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          {COMMENT_CONFIG.label}
        </span>
        <span className="text-[10px] text-muted-foreground">{COMMENT_CONFIG.description}</span>
      </div>
      <kbd className="text-[8px] font-mono bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
        N
      </kbd>
    </div>
  );
}

// Draggable group component
function GroupDraggableNode({ type }: { type: GroupNodeType }) {
  const config = GROUP_TYPES_CONFIG[type];
  const Icon = config.icon;
  const { onDragStart } = useDragEvent(`group-${type}`);
  const shortcut = GROUP_SHORTCUTS[type];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="cursor-grab active:cursor-grabbing bg-zinc-100/50 dark:bg-zinc-900/30 hover:bg-zinc-200 dark:hover:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 rounded-lg p-3 flex flex-col items-center gap-2 transition-all relative group"
    >
      {shortcut && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <kbd className="text-[8px] font-mono bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1 py-0.5 rounded">
            {shortcut}
          </kbd>
        </div>
      )}
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{config.label}</span>
    </div>
  );
}

function GridDraggableNode({ type }: { type: ArchitectureNodeType }) {
  const config = NODE_TYPES_CONFIG[type];
  const Icon = config.icon;
  const { onDragStart } = useDragEvent(type);
  const shortcut = NODE_SHORTCUTS[type];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group cursor-grab active:cursor-grabbing bg-zinc-100/50 dark:bg-zinc-900/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-lg p-3 flex flex-col items-center gap-2 transition-all relative"
    >
      {shortcut && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <kbd className="text-[8px] font-mono bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1 py-0.5 rounded">
            {shortcut}
          </kbd>
        </div>
      )}
      <div className={cn("p-2 rounded-md", config.bgClass)}>
        <Icon
          className={cn("w-4.5 h-4.5", config.iconColor, "group-hover:opacity-90")}
          strokeWidth={1.5}
        />
      </div>
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-200">
        {config.label}
      </span>
    </div>
  );
}

function ListDraggableNode({ type }: { type: ArchitectureNodeType }) {
  const config = NODE_TYPES_CONFIG[type];
  const Icon = config.icon;
  const { onDragStart } = useDragEvent(type);
  const shortcut = NODE_SHORTCUTS[type];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group cursor-grab active:cursor-grabbing flex items-center gap-3 p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition-all relative"
    >
      <span className={cn("p-1.5 rounded", config.bgClass)}>
        <Icon className={cn("w-4 h-4", config.iconColor)} />
      </span>
      <div className="flex flex-col flex-1">
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{config.label}</span>
        <span className="text-[10px] text-muted-foreground">{config.description}</span>
      </div>
      {shortcut && (
        <kbd className="text-[8px] font-mono bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
          {shortcut}
        </kbd>
      )}
    </div>
  );
}
