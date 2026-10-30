import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { ProjectsPage } from "./ProjectsPage";
import {
  diagramsApi,
  projectsApi,
  type ApiDiagramSummary,
  type ApiProject,
  type ApiWorkspaceProject,
} from "@/services/api";
import { preloadEditor } from "@/lib/editorRoute";

vi.mock("@/components/CloudAuth", () => ({
  AccountControls: () => <span>Workspace account</span>,
}));
vi.mock("@/lib/editorRoute", () => ({ preloadEditor: vi.fn<typeof preloadEditor>() }));
vi.mock("@/services/api", () => ({
  projectsApi: {
    workspace: vi.fn<typeof projectsApi.workspace>(),
    list: vi.fn<typeof projectsApi.list>(),
    get: vi.fn<typeof projectsApi.get>(),
    diagrams: vi.fn<typeof projectsApi.diagrams>(),
    create: vi.fn<typeof projectsApi.create>(),
    update: vi.fn<typeof projectsApi.update>(),
    delete: vi.fn<typeof projectsApi.delete>(),
  },
  diagramsApi: {
    get: vi.fn<typeof diagramsApi.get>(),
    create: vi.fn<typeof diagramsApi.create>(),
    delete: vi.fn<typeof diagramsApi.delete>(),
  },
}));

function project(id: string, name: string, description: string | null): ApiProject {
  return {
    id,
    name,
    description,
    color: null,
    createdAt: "2026-10-28T09:15:00Z",
    updatedAt: "2026-10-30T14:32:00Z",
  };
}

function diagram(
  id: string,
  projectId: string,
  name: string,
  description: string | null,
): ApiDiagramSummary {
  return {
    id,
    projectId,
    name,
    description,
    thumbnail: null,
    version: 0,
    revision: 1,
    createdAt: "2026-10-29T11:23:00Z",
    updatedAt: "2026-10-30T16:47:00Z",
  };
}

const checkout: ApiWorkspaceProject = {
  ...project("checkout", "Checkout", "Customer purchase systems"),
  diagrams: [
    diagram("payments", "checkout", "Payment flow", "Authorization and settlement"),
    diagram("orders", "checkout", "Order processing", null),
  ],
};
const platform: ApiWorkspaceProject = {
  ...project("platform", "Platform", "Internal services"),
  diagrams: [diagram("events", "platform", "Event pipeline", "Warehouse ingestion topology")],
};
const emptyProject: ApiWorkspaceProject = {
  ...project("research", "Research", null),
  diagrams: [],
};
const workspace = [checkout, platform, emptyProject];
const mounts: Array<{
  client: QueryClient;
  router: ReturnType<typeof createMemoryRouter>;
}> = [];

type EditorRouteModule = { Component: () => ReturnType<typeof ProjectsPage> };

function renderWorkspace(lazyEditor?: () => Promise<EditorRouteModule>) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  const ProjectPageStub = vi.fn<() => ReturnType<typeof ProjectsPage>>(() => (
    <h1>Project overview</h1>
  ));
  const router = createMemoryRouter(
    [
      { path: "/", element: <ProjectsPage /> },
      { path: "/projects/:projectId", element: <ProjectPageStub /> },
      {
        path: "/projects/:projectId/diagrams/:diagramId",
        ...(lazyEditor ? { lazy: lazyEditor } : { element: <h1>Diagram editor</h1> }),
      },
    ],
    { initialEntries: ["/"] },
  );
  mounts.push({ client, router });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { client, router, ProjectPageStub, user: userEvent.setup() };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(projectsApi.workspace).mockResolvedValue(workspace);
});

afterEach(() => {
  cleanup();
  for (const { client, router } of mounts.splice(0)) {
    router.dispose();
    client.clear();
  }
  vi.restoreAllMocks();
});

describe("unified workspace home", () => {
  it("fetches the workspace once, groups every diagram, and seeds project caches without extra listings", async () => {
    const { client } = renderWorkspace();

    await screen.findByRole("region", { name: checkout.name });
    expect(screen.getAllByRole("region")).toHaveLength(workspace.length);
    for (const { diagrams, ...metadata } of workspace) {
      const section = within(screen.getByRole("region", { name: metadata.name }));
      expect(section.getByRole("heading", { name: new RegExp(metadata.name) })).toBeVisible();

      for (const item of diagrams) {
        expect(section.getByRole("link", { name: `Open ${item.name}` })).toHaveAttribute(
          "href",
          `/projects/${metadata.id}/diagrams/${item.id}`,
        );
      }
      expect(client.getQueryData(["projects", metadata.id])).toEqual(metadata);
      expect(client.getQueryData(["projects", metadata.id, "diagrams"])).toEqual(diagrams);
    }
    expect(
      within(screen.getByRole("region", { name: emptyProject.name })).getByText(
        "No diagrams yet. Add a diagram to this project to get started.",
      ),
    ).toBeVisible();
    for (const description of [
      "Customer purchase systems",
      "Internal services",
      "Authorization and settlement",
      "Warehouse ingestion topology",
    ]) {
      expect(screen.getByText(description)).toBeVisible();
    }
    expect(screen.getAllByRole("link", { name: /^Open / })).toHaveLength(3);
    expect(client.getQueryData(["projects", "workspace"])).toEqual(workspace);
    expect(projectsApi.workspace).toHaveBeenCalledTimes(1);
    expect(projectsApi.list).not.toHaveBeenCalled();
    expect(projectsApi.get).not.toHaveBeenCalled();
    expect(projectsApi.diagrams).not.toHaveBeenCalled();
    expect(diagramsApi.get).not.toHaveBeenCalled();
  });

  it("opens a diagram in one click without rendering the intermediate project page", async () => {
    const { router, ProjectPageStub, user } = renderWorkspace();

    await user.click(await screen.findByRole("link", { name: "Open Event pipeline" }));

    expect(await screen.findByRole("heading", { name: "Diagram editor" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/projects/platform/diagrams/events");
    expect(ProjectPageStub).not.toHaveBeenCalled();
    expect(projectsApi.diagrams).not.toHaveBeenCalled();
  });

  it("keeps the workspace mounted and marks only the target link busy while the editor route loads", async () => {
    let resolveEditor!: (module: EditorRouteModule) => void;
    const editorModule = new Promise<EditorRouteModule>((resolve) => {
      resolveEditor = resolve;
    });
    const lazyEditor = vi.fn<() => Promise<EditorRouteModule>>().mockReturnValue(editorModule);
    const { router, ProjectPageStub, user } = renderWorkspace(lazyEditor);
    const target = await screen.findByRole("link", { name: "Open Event pipeline" });
    const header = screen.getByRole("banner");
    const heading = screen.getByRole("heading", { name: "Projects", level: 1 });
    const main = screen.getByRole("main");
    const sections = screen.getAllByRole("region");
    expect(lazyEditor).not.toHaveBeenCalled();
    expect(target).not.toHaveAttribute("aria-busy");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await user.click(target);

    const opening = within(main).getByRole("status");
    expect(opening.tagName).toBe("OUTPUT");
    expect(opening).toHaveTextContent("Opening diagram…");
    expect(opening).toHaveAttribute("aria-live", "polite");
    expect(target).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("link", { name: "Open Event pipeline" })).toBe(target);
    expect(screen.getByRole("banner")).toBe(header);
    expect(screen.getByRole("heading", { name: "Projects", level: 1 })).toBe(heading);
    expect(screen.getByRole("main")).toBe(main);
    expect(screen.getAllByRole("region")).toHaveLength(workspace.length);
    for (const section of sections) {
      expect(section).toBeVisible();
    }
    for (const name of ["Open Payment flow", "Open Order processing"]) {
      expect(screen.getByRole("link", { name })).not.toHaveAttribute("aria-busy");
    }
    expect(
      screen.queryByRole("status", { name: "Loading projects and diagrams…" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Diagram editor" })).not.toBeInTheDocument();
    expect(lazyEditor).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe("/");
    expect(ProjectPageStub).not.toHaveBeenCalled();

    await act(async () => resolveEditor({ Component: () => <h1>Diagram editor</h1> }));

    expect(await screen.findByRole("heading", { name: "Diagram editor" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/projects/platform/diagrams/events");
    expect(router.state.navigation.state).toBe("idle");
    expect(opening).not.toBeInTheDocument();
    expect(target).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(ProjectPageStub).not.toHaveBeenCalled();
  });

  it("shows the cached workspace without a skeleton while refetching on return from the editor", async () => {
    let resolveWorkspace!: (value: ApiWorkspaceProject[]) => void;
    const refresh = new Promise<ApiWorkspaceProject[]>((resolve) => {
      resolveWorkspace = resolve;
    });
    vi.mocked(projectsApi.workspace).mockResolvedValueOnce(workspace).mockReturnValueOnce(refresh);
    const { client, router, user } = renderWorkspace();
    await user.click(await screen.findByRole("link", { name: "Open Event pipeline" }));
    expect(await screen.findByRole("heading", { name: "Diagram editor" })).toBeVisible();

    await act(async () => {
      await router.navigate(-1);
    });

    await waitFor(() => expect(projectsApi.workspace).toHaveBeenCalledTimes(2));
    const header = screen.getByRole("banner");
    const heading = screen.getByRole("heading", { name: "Projects", level: 1 });
    expect(header).toBeVisible();
    expect(heading).toBeVisible();
    expect(router.state.location.pathname).toBe("/");
    expect(client.getQueryState(["projects", "workspace"])?.fetchStatus).toBe("fetching");
    expect(client.getQueryData(["projects", "workspace"])).toEqual(workspace);
    expect(screen.getAllByRole("region")).toHaveLength(workspace.length);
    expect(screen.getAllByRole("link", { name: /^Open / })).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Open Event pipeline" })).toBeVisible();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("No projects yet")).not.toBeInTheDocument();

    const refreshed = [
      checkout,
      {
        ...platform,
        diagrams: [
          diagram("events", platform.id, "Revised event pipeline", "Updated ingestion topology"),
        ],
      },
      emptyProject,
    ];
    await act(async () => resolveWorkspace(refreshed));

    expect(await screen.findByRole("link", { name: "Open Revised event pipeline" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Open Event pipeline" })).not.toBeInTheDocument();
    expect(screen.getByRole("banner")).toBe(header);
    expect(screen.getByRole("heading", { name: "Projects", level: 1 })).toBe(heading);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(client.getQueryData(["projects", "workspace"])).toEqual(refreshed);
    expect(projectsApi.workspace).toHaveBeenCalledTimes(2);
    expect(projectsApi.diagrams).not.toHaveBeenCalled();
  });

  it.each(["mouseenter", "focus"] as const)(
    "preloads the editor on link %s without navigating or fetching a document",
    async (intent) => {
      const { router } = renderWorkspace();
      const link = await screen.findByRole("link", { name: "Open Payment flow" });
      expect(preloadEditor).not.toHaveBeenCalled();

      if (intent === "mouseenter") {
        fireEvent.mouseEnter(link);
      } else {
        fireEvent.focus(link);
      }

      expect(preloadEditor).toHaveBeenCalledTimes(1);
      expect(router.state.location.pathname).toBe("/");
      expect(diagramsApi.get).not.toHaveBeenCalled();
    },
  );

  it("keeps the header and heading mounted around the inline pending skeleton", async () => {
    let resolveWorkspace!: (value: ApiWorkspaceProject[]) => void;
    vi.mocked(projectsApi.workspace).mockReturnValue(
      new Promise((resolve) => {
        resolveWorkspace = resolve;
      }),
    );
    renderWorkspace();

    const header = screen.getByRole("banner");
    const heading = screen.getByRole("heading", { name: "Projects", level: 1 });
    const main = screen.getByRole("main");
    const status = within(main).getByRole("status", { name: "Loading projects and diagrams…" });
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(within(header).getByText("Workspace account")).toBeVisible();
    expect(within(header).getByRole("button", { name: "New project" })).toBeEnabled();
    expect(screen.getByRole("searchbox", { name: "Search projects and diagrams" })).toBeVisible();
    expect(screen.queryByText("No projects yet")).not.toBeInTheDocument();

    await act(async () => resolveWorkspace(workspace));

    expect(await screen.findByRole("region", { name: checkout.name })).toBeVisible();
    expect(screen.getByRole("banner")).toBe(header);
    expect(screen.getByRole("heading", { name: "Projects", level: 1 })).toBe(heading);
    expect(screen.getByRole("main")).toBe(main);
    expect(status).not.toBeInTheDocument();
  });

  it("shows an inline load error and retries successfully without replacing the shell", async () => {
    vi.mocked(projectsApi.workspace)
      .mockRejectedValueOnce(new Error("Workspace unavailable"))
      .mockResolvedValueOnce(workspace);
    const { user } = renderWorkspace();
    const header = screen.getByRole("banner");
    const heading = screen.getByRole("heading", { name: "Projects", level: 1 });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load your projects and diagrams.");
    expect(screen.queryByText("No projects yet")).not.toBeInTheDocument();
    expect(projectsApi.workspace).toHaveBeenCalledTimes(1);
    await user.click(within(alert).getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("region", { name: checkout.name })).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("banner")).toBe(header);
    expect(screen.getByRole("heading", { name: "Projects", level: 1 })).toBe(heading);
    expect(projectsApi.workspace).toHaveBeenCalledTimes(2);
  });

  it("offers project creation in an empty workspace rather than a blank screen", async () => {
    vi.mocked(projectsApi.workspace).mockResolvedValue([]);
    const { router, user } = renderWorkspace();

    expect(await screen.findByRole("heading", { name: "No projects yet" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Projects", level: 1 })).toBeVisible();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create your first project" }));

    expect(screen.getByRole("dialog", { name: "New Project" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/");
  });

  it.each([
    {
      field: "project name",
      term: "  cHeCkOuT  ",
      parent: checkout,
      names: ["Payment flow", "Order processing"],
    },
    {
      field: "project description",
      term: "customer purchase",
      parent: checkout,
      names: ["Payment flow", "Order processing"],
    },
    { field: "diagram name", term: "EVENT pipeline", parent: platform, names: ["Event pipeline"] },
    { field: "diagram description", term: "settlement", parent: checkout, names: ["Payment flow"] },
  ])(
    "searches by $field locally and preserves direct diagram navigation",
    async ({ term, parent, names }) => {
      const { router, ProjectPageStub, user } = renderWorkspace();
      await screen.findByRole("region", { name: checkout.name });

      await user.type(
        screen.getByRole("searchbox", { name: "Search projects and diagrams" }),
        term,
      );

      expect(screen.getAllByRole("region")).toHaveLength(1);
      const section = within(screen.getByRole("region", { name: parent.name }));
      expect(section.getAllByRole("link", { name: /^Open / })).toHaveLength(names.length);
      for (const name of names) {
        expect(section.getByRole("link", { name: `Open ${name}` })).toBeVisible();
      }
      expect(projectsApi.workspace).toHaveBeenCalledTimes(1);
      const firstDiagram = parent.diagrams.find((item) => item.name === names[0]);
      expect(firstDiagram).toBeDefined();
      await user.click(section.getByRole("link", { name: `Open ${names[0]}` }));

      expect(await screen.findByRole("heading", { name: "Diagram editor" })).toBeVisible();
      expect(router.state.location.pathname).toBe(
        `/projects/${parent.id}/diagrams/${firstDiagram?.id}`,
      );
      expect(ProjectPageStub).not.toHaveBeenCalled();
    },
  );

  it("distinguishes no search results from an empty workspace and clears the filter", async () => {
    const { user } = renderWorkspace();
    await screen.findByRole("region", { name: checkout.name });
    const search = screen.getByRole("searchbox", { name: "Search projects and diagrams" });

    await user.type(search, "unmatched topology");

    expect(screen.getByText("No projects or diagrams match your search.")).toBeVisible();
    expect(screen.queryByText("No projects yet")).not.toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear search" }));

    expect(search).toHaveValue("");
    expect(screen.getAllByRole("region")).toHaveLength(workspace.length);
    expect(screen.getAllByRole("link", { name: /^Open / })).toHaveLength(3);
    expect(projectsApi.workspace).toHaveBeenCalledTimes(1);
  });

  it("creates a project, refreshes the workspace, and stays home", async () => {
    const created = {
      ...project("observability", "Observability", "Service health"),
      color: "#10b981",
    };
    vi.mocked(projectsApi.create).mockResolvedValue(created);
    vi.mocked(projectsApi.workspace)
      .mockResolvedValueOnce(workspace)
      .mockResolvedValue([...workspace, { ...created, diagrams: [] }]);
    const { client, router, ProjectPageStub, user } = renderWorkspace();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await screen.findByRole("region", { name: checkout.name });

    await user.click(screen.getByRole("button", { name: "New project" }));
    const dialog = within(screen.getByRole("dialog", { name: "New Project" }));
    await user.type(dialog.getByRole("textbox", { name: "Name" }), "  Observability  ");
    await user.type(dialog.getByRole("textbox", { name: "Description" }), "  Service health  ");
    await user.click(dialog.getByRole("button", { name: "Use #10b981 as the project color" }));
    await user.click(dialog.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("region", { name: created.name })).toBeVisible();
    expect(projectsApi.create).toHaveBeenCalledTimes(1);
    expect(vi.mocked(projectsApi.create).mock.calls[0]?.[0]).toEqual({
      name: created.name,
      description: created.description,
      color: created.color,
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["projects"] });
    expect(projectsApi.workspace).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(["projects", created.id])).toEqual(created);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Projects", level: 1 })).toBeVisible();
    expect(router.state.location.pathname).toBe("/");
    expect(ProjectPageStub).not.toHaveBeenCalled();
  });

  it.each([checkout, emptyProject])(
    "creates a diagram under $name and opens its editor directly",
    async (parent) => {
      const created = {
        ...diagram("capacity", parent.id, "Capacity plan", "Peak traffic model"),
        data: { nodes: [], edges: [] },
      };
      vi.mocked(diagramsApi.create).mockResolvedValue(created);
      const { client, router, ProjectPageStub, user } = renderWorkspace();
      const invalidate = vi.spyOn(client, "invalidateQueries");
      await screen.findByRole("region", { name: parent.name });

      await user.click(screen.getByRole("button", { name: `New diagram in ${parent.name}` }));
      const dialog = within(screen.getByRole("dialog", { name: "New Diagram" }));
      await user.type(dialog.getByRole("textbox", { name: "Name" }), "  Capacity plan  ");
      await user.type(
        dialog.getByRole("textbox", { name: "Description" }),
        "  Peak traffic model  ",
      );
      await user.click(dialog.getByRole("button", { name: "Create" }));

      expect(await screen.findByRole("heading", { name: "Diagram editor" })).toBeVisible();
      expect(diagramsApi.create).toHaveBeenCalledExactlyOnceWith(parent.id, {
        name: created.name,
        description: created.description,
      });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["projects", "workspace"] });
      expect(router.state.location.pathname).toBe(`/projects/${parent.id}/diagrams/${created.id}`);
      expect(ProjectPageStub).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    },
  );

  it("renames a project and invalidates project queries to refresh its group", async () => {
    const renamed = { ...checkout, name: "Commerce" };
    vi.mocked(projectsApi.update).mockResolvedValue(
      project(checkout.id, renamed.name, checkout.description),
    );
    vi.mocked(projectsApi.workspace)
      .mockResolvedValueOnce(workspace)
      .mockResolvedValue([renamed, platform, emptyProject]);
    const { client, user } = renderWorkspace();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await screen.findByRole("region", { name: checkout.name });

    await user.click(screen.getByRole("button", { name: `Rename ${checkout.name}` }));
    const name = screen.getByRole("textbox", { name: "Project name" });
    expect(name).toHaveValue(checkout.name);
    await user.clear(name);
    await user.type(name, "  Commerce  ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("region", { name: renamed.name })).toBeVisible();
    expect(projectsApi.update).toHaveBeenCalledExactlyOnceWith(checkout.id, { name: renamed.name });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["projects"] });
    expect(screen.queryByRole("textbox", { name: "Project name" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: checkout.name })).not.toBeInTheDocument();
  });

  it("deletes the selected project and refreshes the workspace", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(projectsApi.delete).mockResolvedValue(undefined);
    vi.mocked(projectsApi.workspace)
      .mockResolvedValueOnce(workspace)
      .mockResolvedValue([checkout, emptyProject]);
    const { client, router, user } = renderWorkspace();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await screen.findByRole("region", { name: platform.name });

    await user.click(screen.getByRole("button", { name: `Delete ${platform.name}` }));

    await waitFor(() =>
      expect(screen.queryByRole("region", { name: platform.name })).not.toBeInTheDocument(),
    );
    expect(confirm).toHaveBeenCalledWith('Delete project "Platform" and all its diagrams?');
    expect(vi.mocked(projectsApi.delete).mock.calls[0]?.[0]).toBe(platform.id);
    expect(projectsApi.delete).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["projects"] });
    expect(screen.getByRole("region", { name: checkout.name })).toBeVisible();
    expect(router.state.location.pathname).toBe("/");
  });

  it("deletes only the selected diagram and keeps its now empty project", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(diagramsApi.delete).mockResolvedValue(undefined);
    vi.mocked(projectsApi.workspace)
      .mockResolvedValueOnce(workspace)
      .mockResolvedValue([checkout, { ...platform, diagrams: [] }, emptyProject]);
    const { client, router, user } = renderWorkspace();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await screen.findByRole("link", { name: "Open Event pipeline" });

    await user.click(screen.getByRole("button", { name: "Delete diagram Event pipeline" }));

    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Open Event pipeline" })).not.toBeInTheDocument(),
    );
    expect(confirm).toHaveBeenCalledWith('Delete diagram "Event pipeline"?');
    expect(vi.mocked(diagramsApi.delete).mock.calls[0]?.[0]).toBe("events");
    expect(diagramsApi.delete).toHaveBeenCalledTimes(1);
    expect(projectsApi.delete).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["projects"] });
    expect(
      within(screen.getByRole("region", { name: platform.name })).getByText(/No diagrams yet/),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe("/");
  });

  it.each(["Delete Platform", "Delete diagram Event pipeline"])(
    "does not mutate when %s is cancelled",
    async (action) => {
      vi.spyOn(window, "confirm").mockReturnValue(false);
      const { user } = renderWorkspace();
      await screen.findByRole("region", { name: platform.name });

      await user.click(screen.getByRole("button", { name: action }));

      expect(projectsApi.delete).not.toHaveBeenCalled();
      expect(diagramsApi.delete).not.toHaveBeenCalled();
      expect(projectsApi.workspace).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("link", { name: "Open Event pipeline" })).toBeVisible();
    },
  );
});
