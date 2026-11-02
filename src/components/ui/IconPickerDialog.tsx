import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon, iconLoaded } from "@iconify/react";
import { cn } from "@/lib/utils";
import {
  getIconDisplayName,
  normalizeIconSearchQuery,
  searchIcons,
  searchTechnologyIcons,
  type IconifySearchResult,
} from "@/services/iconify";
import { TECHNOLOGY_ICON_GROUPS } from "@/constants/technologyIcons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface IconPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (iconId: string) => void;
  currentIcon?: string;
}

const curatedIds = new Set(
  TECHNOLOGY_ICON_GROUPS.flatMap((group) => group.icons.map(({ id }) => id)),
);
const buttonClass =
  "rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-300 hover:bg-accent active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function SelectedIconPreview({
  iconId,
  onReady,
}: {
  iconId: string;
  onReady: (iconId: string) => void;
}) {
  const trusted = curatedIds.has(iconId) || iconLoaded(iconId);
  const [status, setStatus] = useState(trusted ? "ready" : "loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (trusted) {
      return;
    }
    // Iconify has no error callback. Bound the wait and keep broken icons unconfirmable.
    const timeout = setTimeout(() => {
      setStatus((previous) => (previous === "loading" ? "error" : previous));
    }, 8000);
    return () => clearTimeout(timeout);
  }, [trusted, attempt]);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border bg-background p-2">
        <Icon
          key={attempt}
          icon={iconId}
          aria-hidden="true"
          className="size-8"
          onLoad={() => {
            setStatus("ready");
            onReady(iconId);
          }}
        />
      </div>
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-medium" title={iconId}>
          {getIconDisplayName(iconId)}
        </p>
        {status === "loading" && (
          <output className="block text-xs text-muted-foreground">Loading icon preview…</output>
        )}
        {status === "error" && (
          <div role="alert" className="text-xs text-destructive">
            <p>Icon preview could not load. Try again or choose another icon.</p>
            <button
              type="button"
              className={cn(buttonClass, "mt-1 text-foreground")}
              onClick={() => {
                setStatus("loading");
                setAttempt((previous) => previous + 1);
              }}
            >
              Retry preview
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Mount a fresh session on every open so cancelling never retains a draft selection or query.
export function IconPickerDialog(props: IconPickerDialogProps) {
  return props.isOpen ? <IconPickerSession {...props} /> : null;
}

// oxlint-disable-next-line complexity, max-lines-per-function -- debt: complexity 17, 203 lines; extract branches and split into smaller units
function IconPickerSession({ onClose, onSelect, currentIcon }: IconPickerDialogProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIcon, setSelectedIcon] = useState(currentIcon ?? "");
  const [loadedIcons, setLoadedIcons] = useState<ReadonlySet<string>>(() => new Set());
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<
    (IconifySearchResult & { query: string; error: string }) | null
  >(null);
  const query = searchQuery.trim();
  const localGroups = useMemo(() => searchTechnologyIcons(query), [query]);
  const localIds = new Set(localGroups.flatMap((group) => group.icons.map(({ id }) => id)));
  const remoteIcons = result?.query === query ? result.icons.filter((id) => !localIds.has(id)) : [];
  const loading = Boolean(query) && result?.query !== query;
  const error = result?.query === query ? result.error : "";
  const canConfirm =
    Boolean(selectedIcon) &&
    (curatedIds.has(selectedIcon) || loadedIcons.has(selectedIcon) || iconLoaded(selectedIcon));

  const handleReady = useCallback((iconId: string) => {
    setLoadedIcons((previous) => new Set([...previous, iconId]));
  }, []);

  useEffect(() => {
    if (!query) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void searchIcons(normalizeIconSearchQuery(query), undefined, 48, controller.signal)
        .then((response) => {
          if (!controller.signal.aborted) {
            setResult({ ...response, query, error: "" });
          }
        })
        .catch((cause: unknown) => {
          if (!controller.signal.aborted) {
            setResult({
              query,
              icons: [],
              total: 0,
              error:
                cause instanceof Error ? cause.message : "The icon catalog could not be searched.",
            });
          }
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, retry]);

  const renderIconButton = (iconId: string, name = getIconDisplayName(iconId)) => (
    <button
      type="button"
      key={iconId}
      onClick={() => setSelectedIcon(iconId)}
      aria-label={`Select ${name}`}
      aria-pressed={selectedIcon === iconId}
      className={cn(
        "flex min-w-0 flex-col items-center justify-start gap-2 rounded-lg border p-3 text-xs transition-colors duration-300 hover:bg-accent active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selectedIcon === iconId ? "border-primary bg-accent" : "border-border",
      )}
      title={`${name} (${iconId})`}
    >
      <span aria-hidden="true" className="flex size-8 items-center justify-center">
        <Icon icon={iconId} className="size-8" />
      </span>
      <span className="w-full break-words text-center text-pretty">{name}</span>
    </button>
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent
        data-editor-shortcuts="blocked"
        initialFocus={searchRef}
        className="flex max-h-[85vh] flex-col gap-4 sm:max-w-3xl"
      >
        <DialogHeader className="pr-8">
          <DialogTitle className="text-lg font-semibold text-balance">Choose an icon</DialogTitle>
          <DialogDescription className="text-pretty">
            Browse popular technologies or search by name. Try Postgres, Node.js, or AWS.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor="icon-picker-search" className="text-sm font-medium">
            Search icons
          </label>
          <input
            ref={searchRef}
            id="icon-picker-search"
            type="search"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              if (event.target.value.trim() !== query) {
                setResult(null);
              }
            }}
            placeholder="Search technologies and symbols"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-1">
          {localGroups.map((group) => (
            <section key={group.name} aria-label={group.name} className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">{group.name}</h3>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {group.icons.map((icon) => renderIconButton(icon.id, icon.name))}
              </div>
            </section>
          ))}

          {query && (
            <section aria-label="More icons" className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">More icons</h3>
              {loading ? (
                <div className="space-y-2">
                  <output className="block text-xs text-muted-foreground">
                    Searching the wider catalog…
                  </output>
                  <div aria-hidden="true" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {["first", "second", "third", "fourth", "fifth", "sixth"].map((slot) => (
                      <div key={slot} className="h-24 rounded-lg bg-muted" />
                    ))}
                  </div>
                </div>
              ) : error ? (
                <div role="alert" className="space-y-2 rounded-lg border border-border p-3">
                  <p className="text-sm text-destructive">{error}</p>
                  <p className="text-xs text-muted-foreground">
                    You can still choose from the curated icons above.
                  </p>
                  <button
                    type="button"
                    className={cn(buttonClass, "border border-border")}
                    onClick={() => {
                      setResult(null);
                      setRetry((previous) => previous + 1);
                    }}
                  >
                    Retry search
                  </button>
                </div>
              ) : remoteIcons.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {remoteIcons.map((iconId) => renderIconButton(iconId))}
                </div>
              ) : (
                <output className="block text-sm text-muted-foreground">
                  {localGroups.length
                    ? "No additional icons found. Choose a match above or try another name."
                    : "No icons found. Try another technology or symbol name."}
                </output>
              )}
            </section>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-muted/50 p-3">
          {selectedIcon ? (
            <SelectedIconPreview key={selectedIcon} iconId={selectedIcon} onReady={handleReady} />
          ) : (
            <p className="text-sm text-muted-foreground">No icon selected</p>
          )}
          <div className="ml-auto flex shrink-0 gap-2">
            <button type="button" onClick={onClose} className={buttonClass}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!canConfirm}
              className={cn(buttonClass, "bg-primary text-primary-foreground hover:bg-primary/90")}
              onClick={() => {
                if (canConfirm) {
                  onSelect(selectedIcon);
                  onClose();
                }
              }}
            >
              Use icon
            </button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-pretty">
          Brand marks belong to their respective owners. Each{" "}
          <a
            href="https://iconify.design/docs/icons/icon-basics.html#licenses"
            target="_blank"
            rel="noopener noreferrer"
            className="underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Iconify collection’s license
          </a>{" "}
          applies. Use of a mark does not imply endorsement.
        </p>
      </DialogContent>
    </Dialog>
  );
}
