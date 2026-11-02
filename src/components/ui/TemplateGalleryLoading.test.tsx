import { ReactFlowProvider } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { TemplateGalleryDialog } from "./TemplateGalleryDialog";
import { layoutTemplate } from "@/templates";
import { useDiagramStore } from "@/store/diagramStore";
import { cloudWorkspace } from "@/services/cloudWorkspace";

vi.mock("@/templates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/templates")>();
  return { ...actual, layoutTemplate: vi.fn(actual.layoutTemplate) };
});

beforeEach(() => {
  useDiagramStore.setState(useDiagramStore.getInitialState());
  vi.spyOn(cloudWorkspace, "schedule").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.mocked(layoutTemplate).mockReset();
  vi.restoreAllMocks();
});

describe("starter template loading state", () => {
  it("does not start ELK to draw any gallery preview", () => {
    render(
      <ReactFlowProvider>
        <TemplateGalleryDialog isOpen onClose={vi.fn<() => void>()} />
      </ReactFlowProvider>,
    );
    expect(layoutTemplate).not.toHaveBeenCalled();
  });

  it("locks the gallery and shows one loading action, even if a different filter was selected", () => {
    vi.mocked(layoutTemplate).mockImplementation(() => new Promise(() => {}));
    render(
      <ReactFlowProvider>
        <TemplateGalleryDialog isOpen onClose={vi.fn<() => void>()} />
      </ReactFlowProvider>,
    );
    const category = screen.getByRole("button", { name: /Marketplaces & logistics/ });
    const search = screen.getByRole("searchbox", { name: "Search templates" });
    const cards = screen.getByRole("region", { name: "Templates" });
    const first = screen.getByRole("button", { name: /Three-tier web app/ });
    const details = screen.getByRole("complementary", { name: "Selected template" });
    fireEvent.click(within(details).getByRole("button", { name: "Use template" }));
    expect(layoutTemplate).toHaveBeenCalledOnce();
    expect(layoutTemplate).toHaveBeenCalledWith(expect.anything(), true);
    expect(within(details).getByRole("button", { name: "Loading template…" })).toBeDisabled();
    expect(within(details).queryByRole("button", { name: "Use template" })).not.toBeInTheDocument();
    expect(category).toBeDisabled();
    expect(search).toBeDisabled();
    expect(first).toBeDisabled();
    fireEvent.click(category);
    fireEvent.click(first);
    expect(layoutTemplate).toHaveBeenCalledOnce();
    expect(cards).toHaveTextContent("Three-tier web app");
    expect(within(details).getByRole("button", { name: "Loading template…" })).toBeDisabled();
  });

  it("shows the same disabled loading state while adding to a non-empty canvas", () => {
    vi.mocked(layoutTemplate).mockImplementation(() => new Promise(() => {}));
    useDiagramStore.setState({
      nodes: [
        { id: "existing", type: "architecture", position: { x: 0, y: 0 }, data: { label: "Existing", type: "service" } },
      ],
    });
    render(
      <ReactFlowProvider>
        <TemplateGalleryDialog isOpen onClose={vi.fn<() => void>()} />
      </ReactFlowProvider>,
    );
    const details = screen.getByRole("complementary", { name: "Selected template" });
    fireEvent.click(within(details).getByRole("button", { name: "Add to canvas" }));
    expect(within(details).getByRole("button", { name: "Loading template…" })).toBeDisabled();
    expect(within(details).queryByRole("button", { name: "Replace" })).not.toBeInTheDocument();
    expect(within(details).queryByRole("button", { name: "Add to canvas" })).not.toBeInTheDocument();
  });
});
