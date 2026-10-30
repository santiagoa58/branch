import { AccountControls } from "@/components/CloudAuth";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  CubeIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
} from "@heroicons/react/24/outline";
import { FolderIcon } from "@heroicons/react/24/solid";
import { projectsApi, ApiProject } from "@/services/api";
import { CreateProjectDialog } from "@/components/workspace/CreateProjectDialog";
import { useThemeStore } from "@/store/themeStore";

export function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useThemeStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ApiProject | null>(null);

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

  const {
    data: projects = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  const deleteMutation = useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string }) => projectsApi.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      setEditingProject(null);
    },
  });

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
        <div className="text-zinc-500 dark:text-zinc-400">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-300">
      {/* Header */}
      <header className="h-14 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-zinc-900 dark:bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-100 dark:text-zinc-950">
            <CubeIcon className="w-4.5 h-4.5" strokeWidth={2} />
          </div>
          <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Branch
          </span>
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
            New Project
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {(deleteMutation.isError || updateMutation.isError) && (
          <p role="alert" className="mb-4 text-sm text-muted-foreground">
            Could not update the project. Please try again.
          </p>
        )}
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-5">Projects</h2>

        {isError ? (
          <div role="alert" className="text-sm text-muted-foreground">
            Could not load your projects.{" "}
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
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <FolderIcon className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">No projects yet</p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 mx-auto bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-zinc-100 dark:text-zinc-900 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors shadow-sm"
            >
              Create your first project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <article
                key={project.id}
                className="group relative border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 hover:border-zinc-400 dark:hover:border-zinc-600 cursor-pointer transition-colors bg-white dark:bg-zinc-900"
              >
                <a
                  href={`/projects/${project.id}`}
                  aria-label={`Open ${project.name}`}
                  className="absolute inset-0 rounded-lg"
                  onClick={(event) => {
                    event.preventDefault();
                    void navigate(`/projects/${project.id}`);
                  }}
                />
                {/* Color indicator */}
                <div
                  className="w-3 h-3 rounded-full mb-3"
                  style={{ backgroundColor: project.color ?? "#3b82f6" }}
                />

                {editingProject?.id === project.id ? (
                  <form
                    className="relative z-10"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      updateMutation.mutate({
                        id: project.id,
                        name: formData.get("name") as string,
                      });
                    }}
                  >
                    <input
                      name="name"
                      defaultValue={project.name}
                      aria-label="Project name"
                      onBlur={() => setEditingProject(null)}
                      className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </form>
                ) : (
                  <h3 className="font-medium text-base mb-1">{project.name}</h3>
                )}

                {project.description && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                    {project.description}
                  </p>
                )}

                <p className="text-xs text-muted-foreground mt-3">
                  Updated {new Date(project.updatedAt).toLocaleDateString()}
                </p>

                {/* Actions */}
                <div className="absolute z-10 top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingProject(project);
                    }}
                    aria-label={`Rename ${project.name}`}
                    className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    <PencilIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete project "${project.name}"?`)) {
                        deleteMutation.mutate(project.id);
                      }
                    }}
                    aria-label={`Delete ${project.name}`}
                    className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950 text-zinc-400 hover:text-red-500"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {createOpen && <CreateProjectDialog onClose={() => setCreateOpen(false)} />}
    </div>
  );
}
