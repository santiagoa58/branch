import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { TemplateGalleryDialog } from "./TemplateGalleryDialog";
import { useDiagramStore } from "@/store/diagramStore";
import { cloudWorkspace } from "@/services/cloudWorkspace";
import { notify } from "@/services/notify";

function mount(onClose = vi.fn<() => void>()) {
  render(
    <ReactFlowProvider>
      <TemplateGalleryDialog isOpen onClose={onClose} />
    </ReactFlowProvider>,
  );
  return onClose;
}

beforeEach(() => {
  useDiagramStore.setState(useDiagramStore.getInitialState());
  vi.spyOn(cloudWorkspace, "schedule").mockImplementation(() => {});
  vi.spyOn(notify, "success").mockReturnValue("loaded");
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn<typeof requestAnimationFrame>(() => 1),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useDiagramStore.setState(useDiagramStore.getInitialState());
});

describe("TemplateGalleryDialog", () => {
  it("finds an app by name, selects it and loads it onto an empty canvas", () => {
    const onClose = mount();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search templates" }), {
      target: { value: "Google Drive" },
    });
    const card = screen.getByRole("button", {
      name: /Cloud file storage and sync, like Google Drive/,
    });
    fireEvent.click(card);
    expect(card).toHaveAttribute("aria-pressed", "true");
    const details = screen.getByRole("complementary", { name: "Selected template" });
    expect(
      within(details).getByRole("heading", { name: "Cloud file storage and sync" }),
    ).toBeVisible();

    fireEvent.click(within(details).getByRole("button", { name: "Use template" }));

    const { nodes, edges, flows } = useDiagramStore.getState();
    expect(nodes.some((node) => node.data["label"] === "Metadata service")).toBe(true);
    expect(edges.length).toBeGreaterThan(5);
    expect(flows).toHaveLength(1);
    expect(onClose).toHaveBeenCalledOnce();
    expect(cloudWorkspace.schedule).toHaveBeenCalledOnce();
  });

  it("filters by category and offers suggestions when nothing matches", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Marketplaces & logistics/ }));
    expect(screen.getByRole("button", { name: /Ride hailing, like Uber/ })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Video streaming platform/ }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search templates" }), {
      target: { value: "no such product" },
    });
    expect(screen.getByText(/No templates match/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "payments" }));
    expect(screen.getByRole("button", { name: /Payments API, like Stripe/ })).toBeVisible();
  });

  it("keeps the current design brief when adding a template", () => {
    const brief = {
      inputs: {
        prompt: "Mine",
        scope: "fullstack" as const,
        requirements: [],
        outOfScope: [],
        answers: [],
      },
      questions: [],
      requirements: [],
      assumptions: [],
      outOfScope: [],
      ranFrom: {},
    };
    useDiagramStore.getState().addNode({
      id: "existing",
      type: "architecture",
      position: { x: 0, y: 0 },
      data: { label: "Existing", type: "service" },
    });
    useDiagramStore.setState({ brief });
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Team chat and messaging, like Slack/ }));
    const details = screen.getByRole("complementary", { name: "Selected template" });

    fireEvent.click(within(details).getByRole("button", { name: "Add to canvas" }));

    expect(useDiagramStore.getState().nodes.length).toBeGreaterThan(1);
    expect(useDiagramStore.getState().brief).toEqual(brief);
  });

  it("adds next to an existing diagram or replaces it only after confirmation", () => {
    useDiagramStore.getState().addNode({
      id: "existing",
      type: "architecture",
      position: { x: 0, y: 0 },
      data: { label: "Existing", type: "service" },
    });
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Team chat and messaging, like Slack/ }));
    const details = screen.getByRole("complementary", { name: "Selected template" });

    fireEvent.click(within(details).getByRole("button", { name: "Replace" }));
    expect(within(details).getByRole("alert")).toHaveTextContent("Replace your current diagram");
    fireEvent.click(within(details).getByRole("button", { name: "Cancel" }));
    expect(useDiagramStore.getState().nodes.map((node) => node.id)).toEqual(["existing"]);

    fireEvent.click(within(details).getByRole("button", { name: "Add to canvas" }));
    const nodes = useDiagramStore.getState().nodes;
    expect(nodes.some((node) => node.id === "existing")).toBe(true);
    expect(nodes.some((node) => node.data["label"] === "WebSocket gateway")).toBe(true);
  });
});
