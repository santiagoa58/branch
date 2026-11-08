import { TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Endpoint } from "@/schemas/aiDesign";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useDiagramStore } from "@/store/diagramStore";
import { unknownEndpointRefs } from "@/utils/aiDesign/applyResults";
import { sectionLabelClass, tagClass } from "./briefEdits";
import { labelLookup } from "./nodeLabels";

const monoClassName = "font-mono wrap-anywhere";

const unique = (keys: readonly string[]) => [...new Set(keys)];

/** `name: type` lines; nothing when the endpoint has no such fields. */
function Fields({ title, fields }: { title: string; fields: Endpoint["request"] }) {
  if (!fields || Object.keys(fields).length === 0) {
    return null;
  }
  return (
    <section aria-label={title} className="min-w-0">
      <h5 className={sectionLabelClass}>{title}</h5>
      <ul className="mt-1 flex flex-col gap-0.5">
        {Object.entries(fields).map(([name, type]) => (
          <li key={name} className={cn(monoClassName, "text-[11.5px] text-foreground")}>
            {name}: {type}
          </li>
        ))}
      </ul>
    </section>
  );
}

function EndpointCard({
  endpoint,
  selected,
  unknown,
  onSelect,
}: {
  endpoint: Endpoint;
  selected: boolean;
  unknown: boolean;
  onSelect: () => void;
}) {
  const hasFields =
    Object.keys(endpoint.request ?? {}).length > 0 ||
    Object.keys(endpoint.response ?? {}).length > 0;
  return (
    <article
      aria-label={`${endpoint.method} ${endpoint.path}`}
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-lg border bg-card px-3 py-2.5 text-card-foreground",
        selected ? "border-ring" : "border-border",
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className="-mx-1.5 -mt-1 flex min-w-0 flex-col gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className={cn(tagClass, "font-mono")}>{endpoint.method}</span>
          <span className={cn(monoClassName, "text-xs font-medium")}>{endpoint.path}</span>
        </span>
        <span className="text-xs text-pretty">{endpoint.summary}</span>
      </button>
      {unknown && (
        <p className="flex items-start gap-1.5 text-xs text-attention">
          <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          <span>
            <span className="font-semibold">Unknown component</span>
            <span className="text-muted-foreground">
              {" "}
              — a service or caller of this endpoint is not on the canvas.
            </span>
          </span>
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        <span className={tagClass}>auth: {endpoint.auth}</span>
        <span className={tagClass}>{endpoint.style}</span>
      </div>
      {hasFields && (
        <div className="grid grid-cols-2 gap-2">
          <Fields title="Request" fields={endpoint.request} />
          <Fields title="Response" fields={endpoint.response} />
        </div>
      )}
      {endpoint.errors.length > 0 && (
        <p className="text-[11.5px] text-muted-foreground">
          Errors: {endpoint.errors.map((error) => `${error.status} ${error.when}`).join(" · ")}
        </p>
      )}
    </article>
  );
}

/**
 * The API tab: endpoints grouped by service, then the events. Selecting an endpoint marks its
 * service and callers on the canvas until another is selected or the tab is left.
 */
export function ApiTab() {
  const api = useDiagramStore((state) => state.brief?.api);
  const brief = useDiagramStore((state) => state.brief);
  const nodes = useDiagramStore((state) => state.nodes);
  const setHighlight = useAiDesignStore((state) => state.setHighlight);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const labelOf = useMemo(() => labelLookup(nodes), [nodes]);
  const unknown = useMemo(
    () => (brief ? unknownEndpointRefs(brief, nodes) : new Set<string>()),
    [brief, nodes],
  );
  const groups = useMemo(() => {
    const byService = new Map<string, Endpoint[]>();
    for (const endpoint of api?.endpoints ?? []) {
      byService.set(endpoint.service, [...(byService.get(endpoint.service) ?? []), endpoint]);
    }
    return [...byService];
  }, [api]);

  // Only a highlight this tab set is cleared on leaving; an update's belongs to the update.
  const owning = useRef(false);
  useEffect(
    () => () => {
      if (owning.current) {
        setHighlight([]);
      }
    },
    [setHighlight],
  );

  if (!api || (api.endpoints.length === 0 && api.events.length === 0)) {
    return (
      <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
        Endpoints and events appear here after an update.
      </p>
    );
  }

  const select = (endpoint: Endpoint) => {
    const deselect = endpoint.key === selectedKey;
    setSelectedKey(deselect ? null : endpoint.key);
    owning.current = !deselect;
    setHighlight(deselect ? [] : unique([endpoint.service, ...endpoint.calledBy]));
  };

  return (
    <div className="flex flex-col gap-4">
      {groups.map(([service, endpoints]) => {
        const callers = unique(endpoints.flatMap((endpoint) => endpoint.calledBy));
        return (
          <section key={service} aria-label={labelOf(service)} className="min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <h3 className={sectionLabelClass}>{labelOf(service)}</h3>
              {callers.length > 0 && (
                <span className="text-[11.5px] text-muted-foreground">
                  Called by {callers.map(labelOf).join(", ")}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-col gap-2">
              {endpoints.map((endpoint) => (
                <EndpointCard
                  key={endpoint.key}
                  endpoint={endpoint}
                  selected={endpoint.key === selectedKey}
                  unknown={unknown.has(endpoint.key)}
                  onSelect={() => select(endpoint)}
                />
              ))}
            </div>
          </section>
        );
      })}
      {api.events.length > 0 && (
        <section aria-label="Events" className="min-w-0">
          <h3 className={sectionLabelClass}>Events</h3>
          <div className="mt-1.5 flex flex-col gap-2">
            {api.events.map((event) => (
              <article
                key={event.name}
                aria-label={event.name}
                className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2.5"
              >
                <span className={cn(monoClassName, "text-xs font-medium")}>{event.name}</span>
                <span className="text-xs text-muted-foreground">
                  {labelOf(event.producer)} → {event.consumers.map(labelOf).join(", ")}
                </span>
                {Object.keys(event.payload).length > 0 && (
                  <span className={cn(monoClassName, "text-[11.5px]")}>
                    {Object.entries(event.payload)
                      .map(([name, type]) => `${name}: ${type}`)
                      .join(", ")}
                  </span>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
