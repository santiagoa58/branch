import { AccountControls } from "@/components/CloudAuth";
import { LoadingState } from "@/components/ui/loading";
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PlusIcon,
  TrashIcon,
  CubeIcon,
  ChevronRightIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
} from "@heroicons/react/24/outline";
import { DocumentIcon } from "@heroicons/react/24/solid";
import { projectsApi, diagramsApi, ApiDiagramSummary } from "@/services/api";
import { CreateDiagramDialog } from "@/components/workspace/CreateDiagramDialog";
import { useThemeStore } from "@/store/themeStore";

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useThemeStore();
  const [createOpen, setCreateOpen] = useState(false);

  const cycleTheme = () => {
    setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");
  };

  const getThemeIcon = () => {
    switch (theme) {
      case "light":
        return <SunIcon className="w-3.5 h-3.5" />;
      case "dark":
        return <MoonIcon className="w-3.5 h-3.5" />;
      case "system":
        return <ComputerDesktopIcon className="w-3.5 h-3.5" />;
    }
  };

  const { data: project, isError: projectError } = useQuery({
    queryKey: ["projects", projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  });

  const {
    data: diagrams = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["projects", projectId, "diagrams"],
    queryFn: () => projectsApi.diagrams(projectId!),
    enabled: !!projectId,
  });

  const deleteMutation = useMutation({
    mutationFn: diagramsApi.delete,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "diagrams"] }),
  });

  if (isLoading) {
    return <LoadingState variant="screen" label="Loading diagrams…" />;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-300">
      {/* Header */}
      <header className="h-14 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              void navigate("/");
            }}
            className="h-8 w-8 bg-zinc-900 dark:bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-100 dark:text-zinc-950 hover:opacity-80 transition-opacity"
          >
            <CubeIcon className="w-4.5 h-4.5" strokeWidth={2} />
          </button>
          <nav className="flex items-center gap-1 text-sm">
            <button
              type="button"
              onClick={() => {
                void navigate("/");
              }}
              className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Branch
            </button>
            {project && (
              <>
                <ChevronRightIcon className="w-3 h-3 text-zinc-400" />
                <span className="text-zinc-500 dark:text-zinc-400 truncate max-w-40">
                  {project.name}
                </span>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <AccountControls />
          <button
            type="button"
            onClick={cycleTheme}
            className="bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 p-1.5 rounded-md transition-colors"
            title={`Theme: ${theme}`}
          >
            {getThemeIcon()}
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-zinc-100 dark:text-zinc-900 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors shadow-sm"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            New Diagram
          </button>
        </div>
      </header>

      {deleteMutation.isError && (
        <p role="alert" className="px-6 py-2 text-sm text-muted-foreground">
          Could not delete the diagram. Please try again.
        </p>
      )}
      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-5">Diagrams</h2>

        {isError || projectError ? (
          <div role="alert" className="text-sm text-muted-foreground">
            Could not load this project.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => {
                void queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
                void refetch();
              }}
            >
              Retry
            </button>
          </div>
        ) : diagrams.length === 0 ? (
          <div className="text-center py-20">
            <DocumentIcon className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">No diagrams yet</p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 mx-auto bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-zinc-100 dark:text-zinc-900 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors shadow-sm"
            >
              Create your first diagram
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {diagrams.map((diagram: ApiDiagramSummary) => (
              <article
                key={diagram.id}
                className="group relative border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-400 dark:hover:border-zinc-600 cursor-pointer transition-colors bg-white dark:bg-zinc-900"
              >
                <a
                  href={`/projects/${projectId}/diagrams/${diagram.id}`}
                  aria-label={`Open ${diagram.name}`}
                  className="absolute inset-0 z-10 rounded-lg"
                  onClick={(event) => {
                    event.preventDefault();
                    void navigate(`/projects/${projectId}/diagrams/${diagram.id}`);
                  }}
                />
                {/* Thumbnail */}
                <div className="aspect-video bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center">
                  {diagram.thumbnail ? (
                    <img
                      src={diagram.thumbnail}
                      alt={diagram.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <DocumentIcon className="w-10 h-10 text-zinc-300 dark:text-zinc-600" />
                  )}
                </div>

                <div className="p-4">
                  <h3 className="font-medium text-sm mb-1">{diagram.name}</h3>
                  {diagram.description && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
                      {diagram.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    v{diagram.version} · Updated {new Date(diagram.updatedAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="absolute z-20 top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete diagram "${diagram.name}"?`)) {
                        deleteMutation.mutate(diagram.id);
                      }
                    }}
                    className="p-1.5 rounded-md bg-white/80 dark:bg-zinc-900/80 hover:bg-red-50 dark:hover:bg-red-950 text-zinc-400 hover:text-red-500"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {createOpen && projectId && (
        <CreateDiagramDialog projectId={projectId} onClose={() => setCreateOpen(false)} />
      )}
    </div>
  );
}
