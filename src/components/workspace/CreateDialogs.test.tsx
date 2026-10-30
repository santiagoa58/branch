import { afterEach, describe, expect, it } from "vite-plus/test";
import { cleanup, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { CreateDiagramDialog } from "./CreateDiagramDialog";

afterEach(cleanup);

describe("workspace dialog theme tokens", () => {
  it.each(["project", "diagram"] as const)(
    "themes the native %s dialog and its controls",
    (kind) => {
      render(
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter>
            {kind === "project" ? (
              <CreateProjectDialog onClose={() => {}} />
            ) : (
              <CreateDiagramDialog projectId="project-id" onClose={() => {}} />
            )}
          </MemoryRouter>
        </QueryClientProvider>,
      );

      const dialog = screen.getByRole("dialog", {
        name: kind === "project" ? "New Project" : "New Diagram",
      });
      expect(dialog.tagName).toBe("DIALOG");
      expect(dialog).toHaveClass("bg-popover", "text-popover-foreground", "border-border");

      const controls = within(dialog);
      for (const name of ["Name", "Description"]) {
        expect(controls.getByRole("textbox", { name })).toHaveClass(
          "bg-background",
          "text-foreground",
          "border-input",
          "placeholder:text-muted-foreground",
          "focus:border-ring",
          "focus:ring-2",
          "focus:ring-ring",
        );
      }

      expect(controls.getByRole("button", { name: "Create" })).toHaveClass(
        "bg-primary",
        "text-primary-foreground",
        "hover:bg-primary/90",
        "focus-visible:ring-ring",
      );
      for (const name of ["Cancel", "Close dialog"]) {
        expect(controls.getByRole("button", { name })).toHaveClass(
          "hover:bg-accent",
          "hover:text-accent-foreground",
          "focus-visible:ring-ring",
        );
      }
    },
  );

  it("themes project color selection and focus rings", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <CreateProjectDialog onClose={() => {}} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const controls = within(screen.getByRole("dialog", { name: "New Project" }));
    for (const color of controls.getAllByRole("button", { name: /as the project color/ })) {
      expect(color).toHaveClass("ring-offset-popover", "focus-visible:ring-ring");
    }
    expect(controls.getByRole("button", { pressed: true })).toHaveClass("ring-ring");
  });
});
