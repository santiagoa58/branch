import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { workspaceQuery } from "@/services/workspaceQuery";
import { EditorDiagramMenu } from "./EditorDiagramMenu";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(workspaceQuery.diagrams("p1").queryKey, []);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <EditorDiagramMenu projectId="p1" diagramId="d1" diagramName="Existing design" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("in-editor diagram management", () => {
  it("opens the existing create form directly from the current diagram", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Diagram actions for Existing design" }));
    const menu = screen.getByRole("menu", { name: "Diagram actions" });
    fireEvent.click(within(menu).getByRole("menuitem", { name: "New diagram" }));

    expect(screen.getByRole("dialog", { name: "New Diagram" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Name" })).toBeVisible();
    expect(screen.queryByRole("menu", { name: "Diagram actions" })).not.toBeInTheDocument();
  });

  it("confirms deletion by name and allows cancellation without removing the diagram", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Diagram actions for Existing design" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete diagram" }));
    const dialog = screen.getByRole("dialog", { name: "Delete diagram?" });
    expect(dialog).toHaveTextContent('Delete diagram "Existing design"?');
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Delete diagram?" })).not.toBeInTheDocument();
  });
});
