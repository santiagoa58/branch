import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vite-plus/test";
import App from "@/App";
import type { DesignBrief, StageOutput } from "@/schemas/aiDesign";
import { diagramDataSchema } from "@/schemas/diagram";
import { diagramsApi, type ApiDiagram } from "@/services/api";
import { aiApi } from "@/services/api/ai";
import { cloudWorkspace } from "@/services/cloudWorkspace";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useDiagramStore } from "@/store/diagramStore";
import { useDesignPipeline } from "./useDesignPipeline";

// The editor itself is irrelevant here: only App's route handling and the stores are under test.
vi.mock("@/components/DiagramEditor", () => ({ DiagramEditor: () => <p>Editor</p> }));
vi.mock("@/components/panels/NodePalette", () => ({ NodePalette: () => null }));
vi.mock("@/components/panels/EditorRightPanel", () => ({ EditorRightPanel: () => null }));
vi.mock("@/components/Navbar", () => ({ Navbar: () => null }));

const brief = (prompt: string): DesignBrief => ({
  inputs: { prompt, scope: "backend", requirements: [], outOfScope: [], answers: [] },
  questions: [],
  requirements: [],
  assumptions: [],
  outOfScope: [],
  ranFrom: {},
});
const diagram = (id: string): ApiDiagram => ({
  id,
  projectId: "p",
  name: id.toUpperCase(),
  description: null,
  thumbnail: null,
  data: diagramDataSchema.parse({ nodes: [], edges: [], brief: brief(`Diagram ${id}`) }),
  revision: 1,
  version: 0,
  createdAt: "today",
  updatedAt: "today",
});
const requirements: StageOutput<"requirements"> = {
  questions: [],
  requirements: [{ kind: "functional", text: "Late result" }],
  assumptions: [],
  outOfScope: [],
};

/** Stage 1 answers only when the test releases it, after the user has left the diagram. */
let release: () => void;
let update: MockInstance<typeof diagramsApi.update>;

beforeEach(() => {
  useAiDesignStore.setState(useAiDesignStore.getInitialState());
  useDiagramStore.getState().resetDiagramState();
  vi.spyOn(diagramsApi, "get").mockImplementation(async (id) => diagram(id));
  update = vi.spyOn(diagramsApi, "update");
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  // The fake ignores the abort signal, like a response already on its way back.
  vi.spyOn(aiApi, "run").mockImplementation(async () => {
    await gate;
    return requirements as never;
  });
});

afterEach(() => {
  cleanup();
  cloudWorkspace.reset();
  vi.restoreAllMocks();
});

/**
 * Starts an update of the open diagram from a component that then unmounts, as the editor's panel
 * does when the user navigates. Resolves when the run has ended.
 */
function startRun() {
  const { result, unmount } = renderHook(() => useDesignPipeline());
  const done = result.current.update();
  unmount();
  expect(useAiDesignStore.getState().running).toBe(true);
  return done;
}

/** Lets the late stage 1 response arrive, then checks that nothing was applied or saved. */
async function expectNothingApplied(done: Promise<void>, prompt: string) {
  await act(async () => {
    release();
    await done;
  });
  expect(aiApi.run).toHaveBeenCalledTimes(1);
  expect(useDiagramStore.getState().brief?.inputs.prompt).toBe(prompt);
  expect(useDiagramStore.getState().brief?.requirements).toEqual([]);
  expect(update).not.toHaveBeenCalled();
}

function renderApp(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/projects/:projectId/diagrams/:diagramId", element: <App /> },
      { path: "/projects/:projectId", element: <p>Project page</p> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("the AI run's lifetime", () => {
  it("is cancelled when another diagram opens, and its late result is dropped", async () => {
    const router = renderApp("/projects/p/diagrams/a");
    await screen.findByText("Editor");
    const done = startRun();

    await act(() => router.navigate("/projects/p/diagrams/b"));

    expect(useAiDesignStore.getState().running).toBe(false);
    expect(useAiDesignStore.getState().controller).toBeNull();
    await screen.findByText("Editor");
    expect(cloudWorkspace.getState().diagram?.id).toBe("b");
    await expectNothingApplied(done, "Diagram b");
  });

  it("is cancelled when the user leaves the editor for another page", async () => {
    const router = renderApp("/projects/p/diagrams/a");
    await screen.findByText("Editor");
    const done = startRun();

    await act(() => router.navigate("/projects/p"));

    expect(screen.getByText("Project page")).toBeTruthy();
    // The document stays active off the editor, so only the route cleanup can end the run.
    expect(cloudWorkspace.getState().diagram?.id).toBe("a");
    expect(useAiDesignStore.getState().running).toBe(false);
    await expectNothingApplied(done, "Diagram a");
  });

  it("is cancelled when the active diagram changes outside the editor", async () => {
    await cloudWorkspace.load("a");
    const done = startRun();

    const loading = cloudWorkspace.load("b");

    expect(useAiDesignStore.getState().running).toBe(false);
    await loading;
    await expectNothingApplied(done, "Diagram b");
  });

  it("is cancelled when the diagram state is reset for another account", async () => {
    await cloudWorkspace.load("a");
    const done = startRun();
    const signal = useAiDesignStore.getState().controller?.signal;

    act(() => useDiagramStore.getState().resetDiagramState());

    expect(signal?.aborted).toBe(true);
    expect(useAiDesignStore.getState().running).toBe(false);
    await act(async () => {
      release();
      await done;
    });
    expect(useDiagramStore.getState().brief).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
});
