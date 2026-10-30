import { AccountControls } from "@/components/CloudAuth";
import { Brand } from "@/components/Brand";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigation } from "react-router-dom";
import { PlusIcon, TrashIcon, PencilIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { DocumentIcon, FolderIcon } from "@heroicons/react/24/solid";
import { projectsApi, diagramsApi, type ApiProject } from "@/services/api";
import { CreateProjectDialog } from "@/components/workspace/CreateProjectDialog";
import { CreateDiagramDialog } from "@/components/workspace/CreateDiagramDialog";
import { preloadEditor } from "@/lib/editorRoute";
import { ThemeToggle } from "@/components/ThemeToggle";

function WorkspaceSkeleton() {
  return (
    <output
      aria-label="Loading projects and diagrams…"
      aria-busy="true"
      className="block space-y-6"
    >
      <span className="sr-only">Loading projects and diagrams…</span>
      {["first", "second", "third"].map((key) => (
        <div
          key={key}
          aria-hidden="true"
          className="rounded-xl border border-border bg-card p-4 space-y-4"
        >
          <div className="h-6 w-48 rounded bg-muted" />
          <div className="h-16 rounded-lg bg-muted/60" />
          <div className="h-16 rounded-lg bg-muted/60" />
        </div>
      ))}
    </output>
  );
}

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const navigation = useNavigation();

  const [createOpen, setCreateOpen] = useState(false);
  const [diagramProject, setDiagramProject] = useState<ApiProject | null>(null);
  const [editingProject, setEditingProject] = useState<ApiProject | null>(null);
  const [projectName, setProjectName] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["projects", "workspace"],
    queryFn: projectsApi.workspace,
    // Keep the cached list visible on return, but refresh summaries after editor changes.
    staleTime: 0,
  });
  const projects = data ?? [];

  useEffect(() => {
    for (const { diagrams, ...project } of data ?? []) {
      queryClient.setQueryData(["projects", project.id], project);
      queryClient.setQueryData(["projects", project.id, "diagrams"], diagrams);
    }
  }, [data, queryClient]);

  const deleteMutation = useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
  const deleteDiagramMutation = useMutation({
    mutationFn: diagramsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => projectsApi.update(id, { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      setEditingProject(null);
    },
  });

  const term = search.trim().toLocaleLowerCase();
  const visibleProjects = projects.flatMap((project) => {
    if (
      !term ||
      `${project.name} ${project.description ?? ""}`.toLocaleLowerCase().includes(term)
    ) {
      return [project];
    }
    const diagrams = project.diagrams.filter((diagram) =>
      `${diagram.name} ${diagram.description ?? ""}`.toLocaleLowerCase().includes(term),
    );
    return diagrams.length ? [{ ...project, diagrams }] : [];
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="min-h-14 border-b border-border flex flex-wrap items-center justify-between gap-4 px-4 py-2 bg-background/80 backdrop-blur-md">
        <Brand />
        <div className="flex items-center gap-2">
          <AccountControls />
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <PlusIcon className="size-4" />
            New project
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-balance">Projects</h1>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">
              Open any diagram directly from your workspace.
            </p>
          </div>
          <label className="flex w-full sm:w-80 items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 focus-within:ring-2 focus-within:ring-ring">
            <MagnifyingGlassIcon
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
            <span className="sr-only">Search projects and diagrams</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search projects and diagrams"
              className="min-w-0 w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            />
          </label>
        </div>

        {navigation.state !== "idle" && navigation.location.pathname.includes("/diagrams/") && (
          <output className="mb-4 block text-sm text-muted-foreground" aria-live="polite">
            Opening diagram…
          </output>
        )}
        {(deleteMutation.isError || updateMutation.isError || deleteDiagramMutation.isError) && (
          <p role="alert" className="mb-4 text-sm text-muted-foreground">
            Could not update the workspace. Please try again.
          </p>
        )}
        {isError && (
          <div role="alert" className="mb-4 text-sm text-muted-foreground">
            Could not load your projects and diagrams.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => {
                void refetch();
              }}
            >
              Retry
            </button>
          </div>
        )}

        {isLoading ? (
          <WorkspaceSkeleton />
        ) : projects.length === 0 && !isError ? (
          <div className="rounded-xl border border-border bg-card px-6 py-16 text-center">
            <FolderIcon aria-hidden="true" className="size-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-base font-semibold">No projects yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create a project, then add your first diagram.
            </p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-4 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Create your first project
            </button>
          </div>
        ) : visibleProjects.length === 0 && projects.length > 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No projects or diagrams match your search.
            </p>
            <button type="button" onClick={() => setSearch("")} className="mt-4 text-sm underline">
              Clear search
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {visibleProjects.map((project) => (
              <section
                key={project.id}
                aria-label={project.name}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {editingProject?.id === project.id ? (
                      <form
                        className="flex flex-wrap items-center gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (projectName.trim()) {
                            updateMutation.mutate({ id: project.id, name: projectName.trim() });
                          }
                        }}
                      >
                        <input
                          value={projectName}
                          onChange={(event) => setProjectName(event.target.value)}
                          aria-label="Project name"
                          maxLength={200}
                          required
                          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <button
                          type="submit"
                          disabled={updateMutation.isPending || !projectName.trim()}
                          className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingProject(null)}
                          className="px-3 py-2 text-sm underline"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <h2 className="flex items-center gap-2 text-base font-semibold">
                        <FolderIcon
                          aria-hidden="true"
                          className="size-4 shrink-0 text-muted-foreground"
                          style={{ color: project.color ?? undefined }}
                        />
                        <Link
                          to={`/projects/${project.id}`}
                          className="truncate rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          {project.name}
                        </Link>
                        <span className="text-xs font-normal text-muted-foreground">
                          {project.diagrams.length}{" "}
                          {project.diagrams.length === 1 ? "diagram" : "diagrams"}
                        </span>
                      </h2>
                    )}
                    {project.description && (
                      <p className="mt-2 text-sm text-muted-foreground text-pretty">
                        {project.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDiagramProject(project)}
                      aria-label={`New diagram in ${project.name}`}
                      className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-accent transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <PlusIcon className="size-4" />
                      New diagram
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProject(project);
                        setProjectName(project.name);
                      }}
                      aria-label={`Rename ${project.name}`}
                      className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <PencilIcon className="size-4" />
                    </button>
                    <button
                      type="button"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (confirm(`Delete project "${project.name}" and all its diagrams?`)) {
                          deleteMutation.mutate(project.id);
                        }
                      }}
                      aria-label={`Delete ${project.name}`}
                      className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <TrashIcon className="size-4" />
                    </button>
                  </div>
                </div>

                {project.diagrams.length === 0 ? (
                  <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                    No diagrams yet. Add a diagram to this project to get started.
                  </p>
                ) : (
                  <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {project.diagrams.map((diagram) => (
                      <li
                        key={diagram.id}
                        className="flex items-center gap-2 rounded-lg border border-border bg-background hover:bg-accent/50 transition-colors duration-300"
                      >
                        <Link
                          to={`/projects/${project.id}/diagrams/${diagram.id}`}
                          aria-label={`Open ${diagram.name}`}
                          aria-busy={
                            (navigation.state !== "idle" &&
                              navigation.location.pathname ===
                                `/projects/${project.id}/diagrams/${diagram.id}`) ||
                            undefined
                          }
                          onMouseEnter={preloadEditor}
                          onFocus={preloadEditor}
                          className="flex flex-1 min-w-0 items-center gap-3 rounded-lg p-3 focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          <span
                            aria-hidden="true"
                            className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted"
                          >
                            {diagram.thumbnail ? (
                              <img
                                src={diagram.thumbnail}
                                alt=""
                                loading="lazy"
                                className="size-full object-cover"
                              />
                            ) : (
                              <DocumentIcon className="size-6 text-muted-foreground" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">
                              {diagram.name}
                            </span>
                            {diagram.description && (
                              <span className="mt-1 block truncate text-xs text-muted-foreground">
                                {diagram.description}
                              </span>
                            )}
                            <span className="mt-2 block text-xs text-muted-foreground">
                              Updated {new Date(diagram.updatedAt).toLocaleDateString()}
                            </span>
                          </span>
                        </Link>
                        <button
                          type="button"
                          disabled={deleteDiagramMutation.isPending}
                          onClick={() => {
                            if (confirm(`Delete diagram "${diagram.name}"?`)) {
                              deleteDiagramMutation.mutate(diagram.id);
                            }
                          }}
                          aria-label={`Delete diagram ${diagram.name}`}
                          className="mr-3 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          <TrashIcon className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </main>
      {createOpen && <CreateProjectDialog onClose={() => setCreateOpen(false)} />}
      {diagramProject && (
        <CreateDiagramDialog
          projectId={diagramProject.id}
          onClose={() => setDiagramProject(null)}
        />
      )}
    </div>
  );
}
