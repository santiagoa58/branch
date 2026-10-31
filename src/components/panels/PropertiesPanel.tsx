import { useState } from "react";
import { useDiagramStore } from "@/store/diagramStore";
import { useAnimationStore } from "@/store/animationStore";
import { useOnboardingStore } from "@/store/onboardingStore";
import { GROUP_TYPES_CONFIG, DATA_FORMATS, COMMENT_CONFIG, PROTOCOL_CONFIG } from "@/constants";
import type { GroupNodeType, DataFormat } from "@/types";
import { cn } from "@/lib/utils";
import { hasDesignDecision } from "@/utils/designDecision";
import { applyValidatedInput } from "@/lib/validatedInput";
import {
  groupNodeTypeSchema,
  edgeProtocolSchema,
  httpMethodSchema,
  dataFormatSchema,
  commentNodeDataSchema,
  groupNodeDataSchema,
  architectureEdgeDataSchema,
} from "@/schemas/diagram";
import {
  XMarkIcon,
  TrashIcon,
  CursorArrowRippleIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

import { CodeEditor } from "@/components/ui/CodeEditor";
import { NodePropertiesPanel } from "./NodePropertiesPanel";
import { InspectorTabs, type InspectorTab } from "./InspectorTabs";
import { DesignDecisionEditor } from "@/components/ui/DesignDecisionEditor";

export function PropertiesPanel() {
  const {
    nodes,
    edges,
    selectedNodeId,
    selectedEdgeId,
    setSelectedNode,
    setSelectedEdge,
    updateNodeData,
    updateGroupData,
    toggleGroupCollapse,
    updateEdgeData,
    deleteEdge,
  } = useDiagramStore();

  const requestDelete = useAnimationStore((s) => s.requestDelete);
  const onboardingActiveStep = useOnboardingStore((s) => s.activeStep);

  // Associate the selected contract side with its edge so changing selection
  // naturally falls back to the request side without an effect-driven reset.
  const [contractSelection, setContractSelection] = useState<{
    edgeId: string | null;
    side: "request" | "response";
  }>({ edgeId: null, side: "request" });
  const contractSide =
    contractSelection.edgeId === selectedEdgeId ? contractSelection.side : "request";

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);

  // Decisions are the primary view; comments and connections retain their basic controls.
  const selectionKey = selectedNode
    ? `node:${selectedNode.id}`
    : selectedEdge
      ? `edge:${selectedEdge.id}`
      : "";
  const [inspectorSelection, setInspectorSelection] = useState<{ key: string; tab: InspectorTab }>({
    key: "",
    tab: "basics",
  });
  const defaultTab = selectedNode && selectedNode.type !== "comment" ? "design" : "basics";
  const activeInspectorTab =
    inspectorSelection.key === selectionKey ? inspectorSelection.tab : defaultTab;
  const chooseInspectorTab = (tab: InspectorTab) =>
    setInspectorSelection({ key: selectionKey, tab });

  if (!selectedNode && !selectedEdge) {
    return (
      <aside className="w-80 xl:w-96 bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 flex flex-col z-20">
        <div className="h-14 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-5 justify-between">
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Properties</span>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="text-center mt-20 opacity-40">
            <CursorArrowRippleIcon className="w-8 h-8 mx-auto mb-3 text-zinc-400 dark:text-zinc-500" />
            <p className="text-xs text-muted-foreground">Select a node to view properties</p>
          </div>
        </div>
      </aside>
    );
  }

  if (selectedNode) {
    // Check if it's a comment node
    if (selectedNode.type === "comment") {
      const commentData = commentNodeDataSchema.parse(selectedNode.data);
      const Icon = COMMENT_CONFIG.icon;
      const color = commentData.color || "yellow";
      const colorConfig = COMMENT_CONFIG.colors[color];

      return (
        <aside className="w-80 xl:w-96 bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 flex flex-col z-20">
          {/* Header */}
          <div className="h-14 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-5 justify-between">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Comment Properties
            </span>
            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-8 animate-slide-in">
            {/* Header Section */}
            <div className="flex items-start gap-4">
              <div className={cn("p-3 rounded-lg border", colorConfig.border, colorConfig.bg)}>
                <Icon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
                  Comment
                </h2>
                <span className="text-[10px] text-muted-foreground font-mono">
                  ID: {selectedNode.id.slice(-8).toUpperCase()}
                </span>
              </div>
            </div>

            <hr className="border-zinc-200 dark:border-zinc-800" />

            {/* Fields */}
            <div className="space-y-4">
              {/* Text Content */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Text
                </span>
                <textarea
                  value={commentData.text || ""}
                  onChange={(e) => updateNodeData(selectedNode.id, { text: e.target.value })}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Add your note here..."
                  rows={6}
                  className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-sm text-zinc-900 dark:text-zinc-200 placeholder:text-muted-foreground focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Color */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Color
                </span>
                <div className="relative">
                  <select
                    value={color}
                    onChange={(e) => updateNodeData(selectedNode.id, { color: e.target.value })}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="w-full appearance-none bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
                  >
                    <option value="yellow">Yellow</option>
                    <option value="blue">Blue</option>
                    <option value="green">Green</option>
                    <option value="pink">Pink</option>
                    <option value="purple">Purple</option>
                  </select>
                  <ChevronDownIcon className="absolute right-2 top-2 w-3 h-3 text-zinc-500 pointer-events-none" />
                </div>
              </div>

              {/* Author */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Author
                </span>
                <input
                  type="text"
                  value={commentData.author || ""}
                  onChange={(e) => updateNodeData(selectedNode.id, { author: e.target.value })}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Your name"
                  className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-muted-foreground focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
                />
              </div>

              {/* Minimized Toggle */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-zinc-700 dark:text-zinc-300">Minimized</span>
                <ToggleSwitch
                  checked={commentData.minimized || false}
                  onChange={(checked) => updateNodeData(selectedNode.id, { minimized: checked })}
                />
              </div>
            </div>

            {/* Metadata Section */}
            <div className="bg-zinc-100/50 dark:bg-zinc-900/50 rounded-lg p-3 border border-zinc-200 dark:border-zinc-800 space-y-2">
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">Comment ID</span>
                <span className="text-zinc-700 dark:text-zinc-300 font-mono">
                  {selectedNode.id.slice(-12)}
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">Created</span>
                <span className="text-zinc-700 dark:text-zinc-300">
                  {commentData.createdAt
                    ? new Date(commentData.createdAt).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">Position X</span>
                <span className="text-zinc-700 dark:text-zinc-300 font-mono">
                  {Math.round(selectedNode.position.x)}
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">Position Y</span>
                <span className="text-zinc-700 dark:text-zinc-300 font-mono">
                  {Math.round(selectedNode.position.y)}
                </span>
              </div>
            </div>

            {/* Delete Button */}
            <button
              type="button"
              onClick={() => requestDelete(selectedNode.id)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              <TrashIcon className="w-3 h-3" />
              Delete Comment
            </button>
          </div>
        </aside>
      );
    }

    // Check if it's a group node
    if (selectedNode.type === "group") {
      const groupData = groupNodeDataSchema.parse(selectedNode.data);
      const config = GROUP_TYPES_CONFIG[groupData.groupType] || GROUP_TYPES_CONFIG.vpc;
      const Icon = config.icon;

      return (
        <aside className="w-80 xl:w-96 bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 flex flex-col z-20">
          {/* Header */}
          <div className="h-14 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-5 justify-between">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Group Properties
            </span>
            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          <InspectorTabs
            items={[
              { id: "basics", label: "Basics" },
              {
                id: "design",
                label: "Decision",
                populated: hasDesignDecision(groupData.decision),
              },
              { id: "advanced", label: "More" },
            ]}
            value={activeInspectorTab}
            onChange={chooseInspectorTab}
          />
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 animate-slide-in">
            {/* Header Section */}
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-100/30 dark:bg-zinc-900/30">
                <Icon className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
                  {groupData.label}
                </h2>
                <span className="text-[10px] text-muted-foreground font-mono">
                  ID: {selectedNode.id.slice(-8).toUpperCase()}
                </span>
              </div>
            </div>

            <hr className="border-zinc-200 dark:border-zinc-800" />

            {/* Fields */}
            <div className="space-y-4">
              <div className={activeInspectorTab === "basics" ? "space-y-4" : "hidden"}>
                {/* Display Name */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    Label
                  </span>
                  <input
                    type="text"
                    value={groupData.label}
                    onChange={(e) => updateGroupData(selectedNode.id, { label: e.target.value })}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                {/* Group Type */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    Type
                  </span>
                  <div className="relative">
                    <select
                      value={groupData.groupType}
                      onChange={(e) =>
                        applyValidatedInput(groupNodeTypeSchema, e.target.value, (groupType) =>
                          updateGroupData(selectedNode.id, { groupType }),
                        )
                      }
                      onKeyDown={(e) => e.stopPropagation()}
                      className="w-full appearance-none bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
                    >
                      {(Object.keys(GROUP_TYPES_CONFIG) as GroupNodeType[]).map((type) => (
                        <option key={type} value={type}>
                          {GROUP_TYPES_CONFIG[type].label}
                        </option>
                      ))}
                    </select>
                    <ChevronDownIcon className="absolute right-2 top-2 w-3 h-3 text-zinc-500 pointer-events-none" />
                  </div>
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    Description
                  </span>
                  <textarea
                    value={groupData.description || ""}
                    onChange={(e) =>
                      updateGroupData(selectedNode.id, { description: e.target.value })
                    }
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="Describe this group..."
                    rows={3}
                    className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-muted-foreground focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors resize-none"
                  />
                </div>
              </div>
              <div className={activeInspectorTab === "advanced" ? "space-y-4" : "hidden"}>
                {/* Collapsed Toggle */}
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-zinc-700 dark:text-zinc-300">Collapsed</span>
                  <ToggleSwitch
                    checked={groupData.collapsed || false}
                    onChange={() => toggleGroupCollapse(selectedNode.id)}
                  />
                </div>
              </div>
            </div>

            <div className={activeInspectorTab === "design" ? "space-y-4" : "hidden"}>
              <DesignDecisionEditor
                key={`decision-${selectedNode.id}`}
                value={groupData.decision}
                onChange={(decision) => updateGroupData(selectedNode.id, { decision })}
              />
            </div>
            <div className={activeInspectorTab === "advanced" ? "space-y-4" : "hidden"}>
              {/* Metadata Section */}
              <div className="bg-zinc-100/50 dark:bg-zinc-900/50 rounded-lg p-3 border border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Group ID</span>
                  <span className="text-zinc-700 dark:text-zinc-300 font-mono">
                    {selectedNode.id.slice(-12)}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Position X</span>
                  <span className="text-zinc-700 dark:text-zinc-300 font-mono">
                    {Math.round(selectedNode.position.x)}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Position Y</span>
                  <span className="text-zinc-700 dark:text-zinc-300 font-mono">
                    {Math.round(selectedNode.position.y)}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Width</span>
                  <span className="text-zinc-700 dark:text-zinc-300 font-mono">
                    {(selectedNode.style?.width as number) || 300}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Height</span>
                  <span className="text-zinc-700 dark:text-zinc-300 font-mono">
                    {(selectedNode.style?.height as number) || 250}
                  </span>
                </div>
              </div>

              {/* Delete Button */}
              <button
                type="button"
                onClick={() => requestDelete(selectedNode.id)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-red-400 bg-red-950/50 border border-red-900/50 rounded-lg hover:bg-red-900/50 transition-colors"
              >
                <TrashIcon className="w-3 h-3" />
                Delete Group
              </button>
            </div>
          </div>
        </aside>
      );
    }

    return (
      <NodePropertiesPanel
        key={selectedNode.id}
        node={selectedNode}
        activeTab={activeInspectorTab}
        onTabChange={chooseInspectorTab}
      />
    );
  }

  if (selectedEdge) {
    const edgeData = architectureEdgeDataSchema.parse(selectedEdge.data ?? {});

    return (
      <aside className="w-80 xl:w-96 bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 flex flex-col z-20">
        {/* Header */}
        <div className="h-14 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-5 justify-between">
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Connection</span>
          <button
            type="button"
            onClick={() => setSelectedEdge(null)}
            className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        <InspectorTabs
          items={[
            { id: "basics", label: "Basics" },
            {
              id: "contract",
              label: "API",
              populated: !!(edgeData.dataContract || edgeData.responseContract),
            },
            {
              id: "design",
              label: "Decision",
              populated: hasDesignDecision(edgeData.decision),
            },
            { id: "advanced", label: "More" },
          ]}
          value={activeInspectorTab}
          onChange={chooseInspectorTab}
        />
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 animate-slide-in">
          {/* Fields */}
          <div className="space-y-4">
            <div className={activeInspectorTab === "basics" ? "space-y-4" : "hidden"}>
              {/* Label */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Label
                </span>
                <input
                  type="text"
                  value={edgeData.label || ""}
                  onChange={(e) => updateEdgeData(selectedEdge.id, { label: e.target.value })}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="e.g., /api/users"
                  className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-muted-foreground focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
                />
              </div>

              {/* Protocol */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Protocol
                </span>
                <div className="relative">
                  <select
                    aria-label="Protocol"
                    value={edgeData.protocol || "http"}
                    onChange={(e) =>
                      applyValidatedInput(edgeProtocolSchema, e.target.value, (protocol) =>
                        updateEdgeData(selectedEdge.id, { protocol }),
                      )
                    }
                    onKeyDown={(e) => e.stopPropagation()}
                    className="w-full appearance-none bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
                  >
                    <optgroup label="Standard">
                      <option value="http">HTTP/REST</option>
                      <option value="grpc">gRPC</option>
                      <option value="graphql">GraphQL</option>
                      <option value="websocket">WebSocket</option>
                      <option value="tcp">TCP</option>
                    </optgroup>
                    <optgroup label="Messaging">
                      <option value="amqp">AMQP</option>
                      <option value="rabbitmq">RabbitMQ</option>
                      <option value="kafka">Kafka</option>
                      <option value="eventbridge">EventBridge</option>
                      <option value="sns">SNS/Push</option>
                    </optgroup>
                    <optgroup label="Data">
                      <option value="sql">SQL/Database</option>
                      <option value="redis">Redis</option>
                      <option value="s3">S3/Blob</option>
                      <option value="vector">Vector Search</option>
                      <option value="search">Search</option>
                    </optgroup>
                    <optgroup label="Auth &amp; DNS">
                      <option value="oauth">OAuth/OIDC</option>
                      <option value="dns">DNS</option>
                    </optgroup>
                    <optgroup label="AI/ML">
                      <option value="inference">AI Inference</option>
                    </optgroup>
                  </select>
                  <ChevronDownIcon className="absolute right-2 top-2 w-3 h-3 text-zinc-500 pointer-events-none" />
                </div>
              </div>

              {/* HTTP Method */}
              {(edgeData.protocol === "http" || !edgeData.protocol) && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    HTTP Method
                  </span>
                  <div className="relative">
                    <select
                      value={edgeData.method || ""}
                      onChange={(e) =>
                        applyValidatedInput(
                          httpMethodSchema.optional(),
                          e.target.value || undefined,
                          (method) => updateEdgeData(selectedEdge.id, { method }),
                        )
                      }
                      onKeyDown={(e) => e.stopPropagation()}
                      className="w-full appearance-none bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
                    >
                      <option value="">None</option>
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="PATCH">PATCH</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                    <ChevronDownIcon className="absolute right-2 top-2 w-3 h-3 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
                  </div>
                </div>
              )}
            </div>
            <div className={activeInspectorTab === "advanced" ? "space-y-4" : "hidden"}>
              {/* Animated Toggle */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-zinc-700 dark:text-zinc-300">Animated</span>
                <div className="flex flex-col">
                  <span className="text-xs text-foreground">Animated Flow</span>
                  <span className="text-[10px] text-muted-foreground">Show data passing</span>
                </div>
                <ToggleSwitch
                  checked={edgeData.animated || false}
                  onChange={(checked) => updateEdgeData(selectedEdge.id, { animated: checked })}
                />
              </div>

              {/* Async Toggle */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-zinc-700 dark:text-zinc-300">Asynchronous</span>
                <div className="flex flex-col">
                  <span className="text-xs text-foreground">Fire & Forget</span>
                  <span className="text-[10px] text-muted-foreground">Non-blocking call</span>
                </div>
                <ToggleSwitch
                  checked={edgeData.async || false}
                  onChange={(checked) => updateEdgeData(selectedEdge.id, { async: checked })}
                />
              </div>

              {/* Bidirectional Toggle */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-zinc-700 dark:text-zinc-300">Bidirectional</span>
                <div className="flex flex-col">
                  <span className="text-xs text-foreground">Two-way Flow</span>
                  <span className="text-[10px] text-muted-foreground">Request/Response</span>
                </div>
                <ToggleSwitch
                  checked={edgeData.bidirectional || false}
                  onChange={(checked) =>
                    updateEdgeData(selectedEdge.id, { bidirectional: checked })
                  }
                />
              </div>

              {/* Latency */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Latency (ms)
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={edgeData.latencyMs ?? ""}
                  onChange={(e) => {
                    const val = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value));
                    updateEdgeData(selectedEdge.id, { latencyMs: val });
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="e.g. 50"
                  className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-muted-foreground focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
                />
                <span className="text-[9px] text-muted-foreground">
                  Used by simulation for packet speed
                </span>
              </div>
            </div>
            <div className={activeInspectorTab === "basics" ? "space-y-4" : "hidden"}>
              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                  Description
                </span>
                <textarea
                  value={edgeData.description || ""}
                  onChange={(e) => updateEdgeData(selectedEdge.id, { description: e.target.value })}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Describe this connection..."
                  rows={3}
                  className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-muted-foreground focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors resize-none"
                />
              </div>
            </div>
            <div className={activeInspectorTab === "design" ? "space-y-4" : "hidden"}>
              <DesignDecisionEditor
                key={selectedEdge.id}
                value={edgeData.decision}
                onChange={(decision) => updateEdgeData(selectedEdge.id, { decision })}
              />
            </div>
          </div>

          <div className={activeInspectorTab === "contract" ? "space-y-4" : "hidden"}>
            <hr className="border-zinc-200 dark:border-zinc-800" />

            {/* Data Contract Section — segmented Request | Response for request/response protocols. */}
            {(() => {
              const supportsResponse =
                edgeData.protocol !== null &&
                edgeData.protocol !== undefined &&
                PROTOCOL_CONFIG[edgeData.protocol]?.requestResponse;
              const activeSide: "request" | "response" = supportsResponse
                ? contractSide
                : "request";
              const fieldKey = activeSide === "response" ? "responseContract" : "dataContract";
              const activeContract = edgeData[fieldKey];
              const updateContract = (patch: Partial<NonNullable<typeof activeContract>>) =>
                updateEdgeData(selectedEdge.id, {
                  [fieldKey]: {
                    format: "json" as DataFormat,
                    ...activeContract,
                    ...patch,
                  },
                });
              const hasResponseContract =
                edgeData.responseContract !== null && edgeData.responseContract !== undefined;

              return (
                <div
                  className={cn(
                    "space-y-4 rounded-lg",
                    onboardingActiveStep === "set-contract" && "onboarding-pulse p-2 -m-2",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                      Data Contract
                    </span>
                    <span className="text-[9px] text-muted-foreground">Optional</span>
                  </div>

                  {/* Segmented control — only for request/response protocols. */}
                  {supportsResponse && (
                    <div className="grid grid-cols-2 gap-0.5 p-0.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded">
                      <button
                        type="button"
                        onClick={() =>
                          setContractSelection({ edgeId: selectedEdge.id, side: "request" })
                        }
                        className={cn(
                          "text-[10px] font-medium uppercase tracking-wide py-1 rounded transition-colors",
                          activeSide === "request"
                            ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300",
                        )}
                      >
                        Request
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setContractSelection({ edgeId: selectedEdge.id, side: "response" })
                        }
                        className={cn(
                          "text-[10px] font-medium uppercase tracking-wide py-1 rounded transition-colors flex items-center justify-center gap-1",
                          activeSide === "response"
                            ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300",
                        )}
                      >
                        Response
                        {hasResponseContract && (
                          <span
                            className="w-1 h-1 rounded-full bg-emerald-500"
                            aria-label="Response contract defined"
                          />
                        )}
                      </button>
                    </div>
                  )}

                  {/* Format */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      Format
                    </span>
                    <div className="relative">
                      <select
                        value={activeContract?.format || "json"}
                        onChange={(e) =>
                          applyValidatedInput(dataFormatSchema, e.target.value, (format) =>
                            updateContract({ format }),
                          )
                        }
                        onKeyDown={(e) => e.stopPropagation()}
                        className="w-full appearance-none bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
                      >
                        {Object.entries(DATA_FORMATS).map(([key, config]) => (
                          <option key={key} value={key}>
                            {config.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDownIcon className="absolute right-2 top-2 w-3 h-3 text-zinc-500 pointer-events-none" />
                    </div>
                  </div>

                  {/* Schema Name */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      Schema Name
                    </span>
                    <input
                      type="text"
                      value={activeContract?.schemaName || ""}
                      onChange={(e) => updateContract({ schemaName: e.target.value })}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder={
                        activeSide === "response"
                          ? "e.g., TaskCreatedResponse"
                          : "e.g., TaskCreatedEvent"
                      }
                      className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-muted-foreground focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Schema Definition */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      Schema Definition
                    </span>
                    <CodeEditor
                      value={activeContract?.schema || ""}
                      onChange={(value) => updateContract({ schema: value })}
                      format={activeContract?.format || "json"}
                      placeholder={DATA_FORMATS[activeContract?.format || "json"].placeholder}
                      height="180px"
                    />
                    <span className="text-[9px] text-muted-foreground">
                      {DATA_FORMATS[activeContract?.format || "json"].description}
                    </span>
                  </div>

                  {/* Contract Description */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      Contract Notes
                    </span>
                    <textarea
                      value={activeContract?.description || ""}
                      onChange={(e) => updateContract({ description: e.target.value })}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder={
                        activeSide === "response"
                          ? "Additional notes about the response contract..."
                          : "Additional notes about this data contract..."
                      }
                      rows={2}
                      className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-200 placeholder:text-muted-foreground focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors resize-none"
                    />
                  </div>
                </div>
              );
            })()}
          </div>
          <div className={activeInspectorTab === "advanced" ? "space-y-4" : "hidden"}>
            {/* Metadata Section */}
            <div className="bg-zinc-100/50 dark:bg-zinc-900/50 rounded-lg p-3 border border-zinc-200 dark:border-zinc-800 space-y-2">
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">Edge ID</span>
                <span className="text-zinc-700 dark:text-zinc-300 font-mono">
                  {selectedEdge.id.slice(-12)}
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">Source</span>
                <span className="text-zinc-700 dark:text-zinc-300 font-mono">
                  {selectedEdge.source.slice(-8)}
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">Target</span>
                <span className="text-zinc-700 dark:text-zinc-300 font-mono">
                  {selectedEdge.target.slice(-8)}
                </span>
              </div>
            </div>

            {/* Delete Button */}
            <button
              type="button"
              onClick={() => deleteEdge(selectedEdge.id)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              <TrashIcon className="w-3 h-3" />
              Delete Connection
            </button>
          </div>
        </div>
      </aside>
    );
  }

  return null;
}

// Custom Toggle Switch Component
function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={checked ? "Disable setting" : "Enable setting"}
      onClick={() => onChange(!checked)}
      className={cn(
        "w-9 h-5 rounded-full border relative transition-colors",
        checked
          ? "bg-zinc-900 dark:bg-zinc-100 border-zinc-700 dark:border-zinc-300"
          : "bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all",
          checked
            ? "left-4.5 bg-zinc-100 dark:bg-zinc-900"
            : "left-0.5 bg-zinc-600 dark:bg-zinc-400",
        )}
      />
    </button>
  );
}
