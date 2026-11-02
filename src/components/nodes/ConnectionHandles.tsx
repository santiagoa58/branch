import { Handle, Position } from "@xyflow/react";

/** Shared side handles for architecture nodes and containers. Defaults remain compatible. */
export function ConnectionHandles({ group = false }: { group?: boolean }) {
  const className = group
    ? "w-3! h-3! rounded-full! bg-zinc-400! border-2! border-white! dark:border-zinc-950! pointer-events-auto!"
    : "w-2! h-2! rounded-full! bg-zinc-400! dark:bg-zinc-600! border-2! border-white! dark:border-zinc-950! hover:scale-150! transition-transform!";
  return (
    <>
      <Handle type="target" position={Position.Left} title="Input left" className={className} />
      <Handle type="source" position={Position.Right} title="Output right" className={className} />
      <Handle type="target" position={Position.Top} id="top" title="Input top" className={className} style={{ left: "40%" }} />
      <Handle type="source" position={Position.Bottom} id="bottom" title="Output bottom" className={className} style={{ left: "60%" }} />
      <Handle type="source" position={Position.Left} id="left" title="Output left" className={className} style={{ top: "35%" }} />
      <Handle type="target" position={Position.Right} id="right" title="Input right" className={className} style={{ top: "65%" }} />
      <Handle type="source" position={Position.Top} id="top" title="Output top" className={className} style={{ left: "60%" }} />
      <Handle type="target" position={Position.Bottom} id="bottom" title="Input bottom" className={className} style={{ left: "40%" }} />
    </>
  );
}
