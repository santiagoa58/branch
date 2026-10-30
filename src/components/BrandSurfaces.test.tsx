import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactFlowProvider } from "@xyflow/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { Navbar } from "./Navbar";
import { ProjectPage } from "@/pages/ProjectPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import type { ApiProject } from "@/services/api";

vi.mock("@/components/CloudAuth", () => ({ AccountControls: () => null }));

const project: ApiProject = {
  id: "project-1",
  name: "Checkout architecture",
  description: null,
  color: null,
  createdAt: "2026-10-30T00:00:00Z",
  updatedAt: "2026-10-30T00:00:00Z",
};

function mount(surface: "projects" | "project" | "editor", theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(["projects"], [project]);
  client.setQueryData(["projects", "workspace"], [{ ...project, diagrams: [] }]);
  client.setQueryData(["projects", project.id], project);
  client.setQueryData(["projects", project.id, "diagrams"], []);
  const router = createMemoryRouter(
    [
      { path: "/", element: <ProjectsPage /> },
      { path: "/projects/:projectId", element: <ProjectPage /> },
      { path: "/projects/:projectId/diagrams/:diagramId", element: <Navbar /> },
    ],
    {
      initialEntries: [
        surface === "projects"
          ? "/"
          : surface === "project"
            ? `/projects/${project.id}`
            : `/projects/${project.id}/diagrams/diagram-1`,
      ],
    },
  );
  render(
    <QueryClientProvider client={client}>
      <ReactFlowProvider>
        <RouterProvider router={router} />
      </ReactFlowProvider>
    </QueryClientProvider>,
  );
  return router;
}

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark");
});

describe.each(["light", "dark"] as const)("%s brand surfaces", (theme) => {
  it.each(["projects", "project", "editor"] as const)(
    "renders one canonical logo and wordmark in the %s header",
    (surface) => {
      mount(surface, theme);

      const header = screen.getByRole("banner");
      const images = header.querySelectorAll("img");
      expect(images).toHaveLength(1);
      expect(images[0]).toHaveAttribute("src", "/branch-mark.svg");
      expect(images[0]).toHaveAttribute("alt", "");
      expect(within(header).getAllByText("Branch")).toHaveLength(1);
      expect(within(header).queryByRole("img")).not.toBeInTheDocument();
    },
  );

  it.each(["project", "editor"] as const)(
    "provides a single named home control on the %s surface",
    async (surface) => {
      const router = mount(surface, theme);

      const home = screen.getByRole("button", { name: /^Branch$/ });
      expect(home).toHaveClass("focus-visible:outline-2");
      fireEvent.click(home);
      await screen.findByRole("heading", { name: "Projects" });
      expect(router.state.location.pathname).toBe("/");
    },
  );
});
