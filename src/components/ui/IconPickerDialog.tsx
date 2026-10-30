import { useState, useEffect, useMemo } from "react";
import { X, Search, Sparkles } from "lucide-react";
import { LoadingState } from "@/components/ui/loading";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import {
  searchIcons,
  getCollections,
  getFeaturedCollections,
  type IconifyCollection,
} from "@/services/iconify";
import { notify } from "@/services/notify";
import { TECHNOLOGY_ICON_GROUPS } from "@/constants/technologyIcons";

interface IconPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (iconId: string) => void;
  currentIcon?: string;
}

export function IconPickerDialog({
  isOpen,
  onClose,
  onSelect,
  currentIcon,
}: IconPickerDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCollection, setSelectedCollection] = useState<string>("");
  const [icons, setIcons] = useState<string[]>([]);
  const [collections, setCollections] = useState<IconifyCollection[]>([]);
  const [selectedIcon, setSelectedIcon] = useState<string>(currentIcon || "");
  const [loading, setLoading] = useState(false);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [error, setError] = useState<string>("");
  const [totalResults, setTotalResults] = useState(0);

  const [previousOpen, setPreviousOpen] = useState(isOpen);
  if (previousOpen !== isOpen) {
    setPreviousOpen(isOpen);
    if (isOpen) {
      setSelectedIcon(currentIcon || "");
    }
  }

  // Cancel both the debounce and any in-flight request when the query changes.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const controller = new AbortController();
    const handleSearch = async () => {
      setIcons([]);
      setTotalResults(0);
      setError("");
      setLoading(!!searchQuery.trim());
      if (!searchQuery.trim()) {
        return;
      }
      try {
        const result = await searchIcons(
          searchQuery.trim(),
          selectedCollection || undefined,
          48,
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setIcons(result.icons);
          setTotalResults(result.total);
        }
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        const errorMessage = err instanceof Error ? err.message : "Failed to search icons";
        setError(errorMessage);
        notify.error({ title: "Search failed", message: errorMessage });
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    const handler = setTimeout(() => void handleSearch(), 300);
    return () => {
      clearTimeout(handler);
      controller.abort();
    };
  }, [searchQuery, selectedCollection, isOpen]);

  // Load collections on mount
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let active = true;
    const loadCollections = async () => {
      setLoadingCollections(true);
      try {
        const cols = await getCollections();
        if (active) {
          setCollections(cols);
        }
      } catch (err) {
        console.error("Failed to load collections:", err);
        // Non-critical, continue without collections
      } finally {
        if (active) {
          setLoadingCollections(false);
        }
      }
    };

    void loadCollections();
    return () => {
      active = false;
    };
  }, [isOpen]);

  const handleIconSelect = (iconId: string) => {
    setSelectedIcon(iconId);
  };

  const handleConfirm = () => {
    if (selectedIcon) {
      onSelect(selectedIcon);
      onClose();
    }
  };

  const handleClose = () => {
    onClose();
  };

  const featuredCollections = useMemo(() => {
    const featured = getFeaturedCollections();
    return collections.filter((col) => featured.includes(col.prefix));
  }, [collections]);

  const browsing = !searchQuery.trim();
  const browseGroups = TECHNOLOGY_ICON_GROUPS.map((group) => ({
    ...group,
    icons: group.icons.filter(
      (icon) => !selectedCollection || icon.id.startsWith(`${selectedCollection}:`),
    ),
  })).filter((group) => group.icons.length > 0);

  const renderIconButton = (iconId: string, name = iconId) => (
    <button
      type="button"
      key={iconId}
      onClick={() => handleIconSelect(iconId)}
      aria-label={`Select ${name}${name === iconId ? "" : ` (${iconId})`}`}
      aria-pressed={selectedIcon === iconId}
      className={cn(
        "aspect-square p-3 rounded-lg border-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selectedIcon === iconId
          ? "border-primary bg-accent"
          : "border-zinc-200 dark:border-zinc-700",
      )}
      title={name === iconId ? iconId : `${name} (${iconId})`}
    >
      <Icon
        icon={iconId}
        aria-hidden="true"
        className="w-full h-full text-zinc-700 dark:text-zinc-300"
      />
    </button>
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      data-editor-shortcuts="blocked"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Choose Icon</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close icon picker"
            className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="p-4 space-y-3 border-b border-zinc-200 dark:border-zinc-800">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              aria-label="Search icons"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search icons (e.g., database, kubernetes, docker)..."
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          {/* Collection Filter */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="icon-collection"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Collection:
            </label>
            <select
              id="icon-collection"
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-zinc-900 dark:text-zinc-100"
              disabled={loadingCollections}
            >
              <option value="">All Collections</option>
              {featuredCollections.length > 0 && (
                <optgroup label="Featured">
                  {featuredCollections.map((col) => (
                    <option key={col.prefix} value={col.prefix}>
                      {col.name || col.prefix} ({col.total})
                    </option>
                  ))}
                </optgroup>
              )}
              {collections.length > featuredCollections.length && (
                <optgroup label="All Collections">
                  {collections.map((col) => (
                    <option key={col.prefix} value={col.prefix}>
                      {col.name || col.prefix} ({col.total})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Results count */}
          {totalResults > 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Found {totalResults.toLocaleString()} icon{totalResults !== 1 ? "s" : ""}
              {icons.length < totalResults && ` (showing ${icons.length})`}
            </p>
          )}
        </div>

        {/* Icon Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {browsing ? (
            <div className="space-y-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Featured technology icons. Search for more brands and system symbols.
              </p>
              {browseGroups.length === 0 && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No featured icons in this collection. Search to explore it, or choose All
                  Collections.
                </p>
              )}
              {browseGroups.map((group) => (
                <section key={group.name} aria-label={group.name} className="space-y-2">
                  <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {group.name}
                  </h3>
                  <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
                    {group.icons.map((icon) => renderIconButton(icon.id, icon.name))}
                  </div>
                </section>
              ))}
            </div>
          ) : loading ? (
            <LoadingState label="Searching icons..." className="h-64" />
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <X className="w-6 h-6 text-red-500" />
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{error}</p>
            </div>
          ) : icons.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Search className="w-12 h-12 text-zinc-300 dark:text-zinc-700" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {searchQuery
                  ? "No icons found. Try a different search term."
                  : "Type to search for icons"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
              {icons.map((iconId) => renderIconButton(iconId))}
            </div>
          )}
        </div>

        <p className="px-4 pb-3 text-xs text-zinc-500 dark:text-zinc-400">
          Brand marks are the property of their respective owners. Each{" "}
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

        {/* Footer with Preview & Actions */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
          {/* Selected Icon Preview */}
          <div className="flex items-center gap-3">
            {selectedIcon ? (
              <>
                <div className="w-10 h-10 p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                  <Icon
                    icon={selectedIcon}
                    className="w-full h-full text-zinc-700 dark:text-zinc-300"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                    {selectedIcon}
                  </span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    {selectedIcon.split(":")[0]}
                  </span>
                </div>
              </>
            ) : (
              <span className="text-sm text-zinc-500 dark:text-zinc-400">No icon selected</span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedIcon}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                selectedIcon
                  ? "bg-blue-500 hover:bg-blue-600 text-white"
                  : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed",
              )}
            >
              Select Icon
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
