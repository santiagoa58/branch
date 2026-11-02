import { beforeEach, afterEach, describe, expect, it, vi } from "vite-plus/test";
import { render, screen, waitFor, act, cleanup, fireEvent } from "@testing-library/react";
import { StrictMode, Suspense, lazy, useEffect } from "react";
import { MemoryRouter, Routes, Route, useParams } from "react-router-dom";
import { AccountControls, CloudAuth, RequireAuth } from "./CloudAuth";
import { cloudWorkspace, useCloudWorkspace } from "@/services/cloudWorkspace";
import { diagramsApi, projectsApi, type ApiDiagram } from "@/services/api";
import { useDiagramStore } from "@/store/diagramStore";
import { useAnimationStore } from "@/store/animationStore";
import { diagramDataSchema } from "@/schemas/diagram";
const auth = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: true,
  userId: "alice",
  getToken: vi.fn<() => Promise<string | null>>(),
}));
const clerk = vi.hoisted(() => ({
  signOut: vi.fn<(callback?: () => void) => Promise<void>>(),
  openUserProfile: vi.fn<() => void>(),
  routerPush: (_url: string) => {},
  routerReplace: (_url: string) => {},
}));
const providerConfig = vi.hoisted(() =>
  vi.fn<(config: { telemetry: unknown; appearance: unknown }) => void>(),
);
vi.mock("@clerk/react", () => ({
  useAuth: () => auth,
  useClerk: () => clerk,
  ClerkProvider: ({
    children,
    routerPush,
    routerReplace,
    telemetry,
    appearance,
  }: {
    children: import("react").ReactNode;
    routerPush: (url: string) => void;
    routerReplace: (url: string) => void;
    telemetry: unknown;
    appearance: unknown;
  }) => {
    providerConfig({ telemetry, appearance });
    clerk.routerPush = routerPush;
    clerk.routerReplace = routerReplace;
    return children;
  },
  SignIn: () => <p>Sign-in panel</p>,
  SignUp: () => <p>Sign-up panel</p>,
}));
const data = diagramDataSchema.parse({ nodes: [], edges: [], flows: [] });
const diagram: ApiDiagram = {
  id: "a",
  projectId: "p",
  name: "A",
  data,
  revision: 1,
  version: 0,
  description: null,
  thumbnail: null,
  createdAt: "today",
  updatedAt: "today",
};
beforeEach(() => {
  vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_placeholder");
  auth.isLoaded = true;
  auth.isSignedIn = true;
  clerk.signOut.mockReset().mockResolvedValue(undefined);
  clerk.openUserProfile.mockReset();
  providerConfig.mockClear();
  auth.userId = "alice";
  auth.getToken = vi.fn<() => Promise<string | null>>().mockResolvedValue("token");
  vi.spyOn(diagramsApi, "get").mockResolvedValue(diagram);
});
afterEach(() => {
  cleanup();
  cloudWorkspace.reset();
  useDiagramStore.getState().resetDiagramState();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const gate = () => (
  <CloudAuth>
    <MemoryRouter>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route
            path="/"
            element={
              <>
                <p>Protected workspace</p>
                <AccountControls />
              </>
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>
  </CloudAuth>
);
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const node = {
  id: "private",
  type: "architecture",
  position: { x: 0, y: 0 },
  data: { label: "Private unsaved node", type: "service" },
};

describe("cloud authentication transitions", () => {
  it("disables optional telemetry and uses the canonical Branch logo in Clerk UI", () => {
    render(<CloudAuth>Workspace</CloudAuth>);
    expect(providerConfig).toHaveBeenCalledOnce();
    expect(providerConfig.mock.calls[0]?.[0].telemetry).toBe(false);
    expect(providerConfig.mock.calls[0]?.[0].appearance).toMatchObject({
      options: { logoImageUrl: "/branch-mark.svg" },
    });
  });

  it("authenticates child requests when a lazy route reveals under StrictMode", async () => {
    const outcomes: unknown[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response("[]"));
    vi.stubGlobal("fetch", fetcher);
    function Page() {
      useEffect(() => {
        void projectsApi.list().then(
          (result) => outcomes.push(result),
          (error: unknown) => outcomes.push(error),
        );
      }, []);
      return <p>Protected page</p>;
    }
    let reveal!: (page: { default: typeof Page }) => void;
    const LazyPage = lazy(
      () =>
        new Promise<{ default: typeof Page }>((resolve) => {
          reveal = resolve;
        }),
    );
    render(
      <StrictMode>
        <CloudAuth>
          <MemoryRouter>
            <Suspense fallback={<p>Loading page</p>}>
              <Routes>
                <Route element={<RequireAuth />}>
                  <Route path="/" element={<LazyPage />} />
                </Route>
              </Routes>
            </Suspense>
          </MemoryRouter>
        </CloudAuth>
      </StrictMode>,
    );
    await screen.findByText("Loading page");
    await act(async () => {
      reveal({ default: Page });
    });
    await screen.findByText("Protected page");
    await waitFor(() => expect(outcomes).toHaveLength(2));
    expect(outcomes).toEqual([[], []]);
  });
  it("keeps API authentication available when Clerk refreshes its token getter", async () => {
    const view = render(gate());
    await waitFor(() => expect(screen.queryByText("Loading workspace…")).toBeNull());
    let resolveToken!: (token: string) => void;
    const refreshedToken = new Promise<string>((resolve) => {
      resolveToken = resolve;
    });
    auth.getToken = vi.fn<() => Promise<string | null>>(() => refreshedToken);
    view.rerender(gate());
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("[]"));
    vi.stubGlobal("fetch", fetcher);
    const request = projectsApi.list();
    await act(async () => {
      resolveToken("refreshed-token");
    });
    await expect(request).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("does not enter the workspace when Clerk has no session token", async () => {
    auth.getToken.mockResolvedValue(null);
    render(gate());
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load your session");
    expect(screen.getByRole("button", { name: "Retry session" })).toBeInTheDocument();
  });
  it("preserves unsaved in-memory edits when a session expires", async () => {
    const view = render(gate());
    await waitFor(() => expect(screen.queryByText("Loading workspace…")).toBeNull());
    await act(async () => {
      await cloudWorkspace.load("a");
    });
    act(() => {
      useDiagramStore.getState().addNode({
        id: "s",
        type: "architecture",
        position: { x: 0, y: 0 },
        data: { label: "Unsaved", type: "service" },
      });
    });
    auth.isSignedIn = false;
    view.rerender(gate());
    expect(screen.getByText("Sign-in panel")).toBeInTheDocument();
    expect(cloudWorkspace.getState().dirty).toBe(true);
    const beforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);
    expect(useDiagramStore.getState().nodes[0]?.data["label"]).toBe("Unsaved");
  });
  it("clears private clipboard when the account changes", async () => {
    const view = render(gate());
    await waitFor(() => expect(screen.queryByText("Loading workspace…")).toBeNull());
    await act(async () => {
      await cloudWorkspace.load("a");
    });
    act(() => {
      useDiagramStore.setState({
        nodes: [
          {
            id: "private",
            selected: true,
            type: "architecture",
            position: { x: 0, y: 0 },
            data: { label: "Private", type: "service" },
          },
        ],
      });
      useDiagramStore.getState().copySelectedNodes();
    });
    auth.userId = "bob";
    view.rerender(gate());
    await waitFor(() => expect(screen.queryByText("Loading workspace…")).toBeNull());
    expect(useDiagramStore.getState().clipboard).toEqual({ nodes: [], edges: [] });
  });
  it("requires the original owner's return to export or retry recovery", async () => {
    const view = render(gate());
    await screen.findByText("Protected workspace");
    await act(async () => {
      await cloudWorkspace.load("a");
    });
    act(() => {
      useDiagramStore.getState().addNode(node);
    });
    const snapshot = diagramDataSchema.parse(useDiagramStore.getState().exportDiagram());
    const update = vi
      .spyOn(diagramsApi, "update")
      .mockResolvedValue({ ...diagram, data: snapshot, revision: 2 });
    auth.userId = "bob";
    view.rerender(gate());
    await screen.findByRole("alert", { name: "Unsaved workspace recovery" });
    expect(screen.queryByText(node.data.label)).toBeNull();
    expect(useDiagramStore.getState().exportDiagram()).toEqual(snapshot);
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Sign in with original account"));
    await waitFor(() => expect(clerk.signOut).toHaveBeenCalledWith(expect.any(Function)));
    expect(cloudWorkspace.getState().dirty).toBe(true);

    auth.isSignedIn = false;
    view.rerender(gate());
    expect(screen.getByText("Sign-in panel")).toBeInTheDocument();
    act(() => {
      clerk.routerPush("/");
      clerk.routerReplace("/");
    });
    expect(cloudWorkspace.getState().dirty).toBe(true);
    expect(useDiagramStore.getState().exportDiagram()).toEqual(snapshot);
    auth.userId = "alice";
    auth.isSignedIn = true;
    view.rerender(gate());
    await screen.findByText("Retry saving edits");
    expect(screen.getByText("Download recovery JSON")).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Retry saving edits"));
    await screen.findByText("Protected workspace");
    expect(update).toHaveBeenCalledWith("a", { data: snapshot, expectedRevision: 1 });
    expect(cloudWorkspace.getState()).toMatchObject({ dirty: false, locked: false });
    expect(useDiagramStore.getState().exportDiagram()).toEqual(snapshot);
  });
  it("keeps recovery data on a failed retry and allows the original owner to download it", async () => {
    const view = render(gate());
    await screen.findByText("Protected workspace");
    await act(async () => {
      await cloudWorkspace.load("a");
    });
    act(() => {
      useDiagramStore.getState().addNode(node);
    });
    const snapshot = diagramDataSchema.parse(useDiagramStore.getState().exportDiagram());
    auth.isSignedIn = false;
    view.rerender(gate());
    auth.isSignedIn = true;
    view.rerender(gate());
    await screen.findByText("Retry saving edits");
    vi.spyOn(diagramsApi, "update").mockRejectedValue(new Error("Still offline"));
    fireEvent.click(screen.getByText("Retry saving edits"));
    await screen.findByText("Still offline");
    expect(cloudWorkspace.getState()).toMatchObject({ dirty: true, locked: true });
    expect(useDiagramStore.getState().exportDiagram()).toEqual(snapshot);
    const createUrl = vi.fn<(blob: Blob) => string>().mockReturnValue("blob:recovery");
    const revokeUrl = vi.fn<(url: string) => void>();
    vi.stubGlobal(
      "URL",
      class extends URL {
        static override createObjectURL = createUrl;
        static override revokeObjectURL = revokeUrl;
      },
    );
    const downloads: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });
    fireEvent.click(screen.getByText("Download recovery JSON"));
    expect(createUrl).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(downloads).toEqual(["branch-recovery.json"]);
    expect(revokeUrl).toHaveBeenCalledWith("blob:recovery");
    const blob = createUrl.mock.calls[0]?.[0];
    if (!blob) {
      throw new Error("Recovery download was not created");
    }
    const contents = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result));
      reader.readAsText(blob);
    });
    expect(contents).toBe(JSON.stringify(snapshot, null, 2));
    expect(cloudWorkspace.getState().dirty).toBe(true);
  });
  it.each(["resolve", "reject"])(
    "waits to mount a reauthenticated diagram route until pending sign-out promises %s",
    async (outcome) => {
      function DiagramRoute() {
        const { projectId, diagramId } = useParams();
        const cloud = useCloudWorkspace();
        useEffect(() => {
          if (diagramId) {
            void cloudWorkspace.load(diagramId, projectId).catch(() => {});
          }
          return () => cloudWorkspace.cancelLoad();
        }, [diagramId, projectId]);
        return (
          <>
            <output>
              {cloud.diagram?.id === diagramId ? "Loaded diagram" : "Loading diagram…"}
            </output>
            <AccountControls />
          </>
        );
      }
      const diagramGate = () => (
        <CloudAuth>
          <MemoryRouter initialEntries={["/projects/p/diagrams/a"]}>
            <Routes>
              <Route element={<RequireAuth />}>
                <Route path="/projects/:projectId/diagrams/:diagramId" element={<DiagramRoute />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </CloudAuth>
      );
      const load = vi.spyOn(cloudWorkspace, "load");
      const signingOut = deferred<void>();
      clerk.signOut.mockReturnValue(signingOut.promise);
      try {
        const view = render(diagramGate());
        await screen.findByText("Loaded diagram");
        expect(load).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByText("Sign out"));
        await waitFor(() => expect(clerk.signOut).toHaveBeenCalledOnce());
        auth.isSignedIn = false;
        view.rerender(diagramGate());
        expect(screen.getByText("Sign-in panel")).toBeInTheDocument();
        expect(cloudWorkspace.getState()).toMatchObject({ diagram: null, locked: true });

        auth.isSignedIn = true;
        view.rerender(diagramGate());
        await act(async () => {});
        expect(screen.getByText("Loading workspace…")).toBeInTheDocument();
        expect(screen.queryByText("Loading diagram…")).toBeNull();
        expect(screen.queryByText("Loaded diagram")).toBeNull();
        expect(load).toHaveBeenCalledTimes(1);
        expect(diagramsApi.get).toHaveBeenCalledTimes(1);

        await act(async () => {
          if (outcome === "resolve") {
            signingOut.resolve();
          } else {
            signingOut.reject(new Error("Sign-out failed after reauthentication"));
          }
        });
        await screen.findByText("Loaded diagram");
        expect(load).toHaveBeenCalledTimes(2);
        expect(load).toHaveBeenLastCalledWith("a", "p");
        expect(diagramsApi.get).toHaveBeenCalledTimes(2);
        expect(cloudWorkspace.getState()).toMatchObject({
          diagram: { id: "a" },
          status: "saved",
          locked: false,
        });
      } finally {
        await act(async () => {
          signingOut.resolve();
        });
      }
    },
  );
  it("locks store edits and deletion requests throughout save and async sign-out", async () => {
    const view = render(gate());
    await screen.findByText("Protected workspace");
    await act(async () => {
      await cloudWorkspace.load("a");
    });
    act(() => {
      useDiagramStore.getState().addNode(node);
    });
    const snapshot = diagramDataSchema.parse(useDiagramStore.getState().exportDiagram());
    const save = deferred<ApiDiagram>();
    const signingOut = deferred<void>();
    vi.spyOn(diagramsApi, "update").mockReturnValue(save.promise);
    clerk.signOut.mockReturnValue(signingOut.promise);
    fireEvent.click(screen.getByText("Sign out"));
    const attemptMutations = () => {
      const before = useDiagramStore.getState();
      act(() => {
        before.addNode({ ...node, id: "late" });
        before.updateNodeData(node.id, { label: "Late edit" });
        before.onNodesChange([
          { type: "position", id: node.id, position: { x: 50, y: 50 }, dragging: false },
        ]);
        before.deleteNode(node.id);
        before.importDiagram(data);
        before.clearDiagram();
        before.undo();
        useAnimationStore.getState().requestDelete(node.id);
        useAnimationStore.getState().requestDeleteMultiple([node.id]);
      });
      expect(useDiagramStore.getState()).toBe(before);
      expect(useAnimationStore.getState().pendingDeletions.size).toBe(0);
      expect(cloudWorkspace.getState().locked).toBe(true);
    };
    attemptMutations();
    expect(clerk.signOut).not.toHaveBeenCalled();
    await act(async () => {
      save.resolve({ ...diagram, data: snapshot, revision: 2 });
    });
    await waitFor(() => expect(clerk.signOut).toHaveBeenCalledOnce());
    attemptMutations();
    expect(cloudWorkspace.getState().dirty).toBe(false);
    auth.isSignedIn = false;
    view.rerender(gate());
    expect(cloudWorkspace.getState().locked).toBe(true);
    expect(useDiagramStore.getState().nodes).toEqual([]);
    expect(screen.getByText("Sign-in panel")).toBeInTheDocument();
    await act(async () => {
      signingOut.resolve();
    });
    expect(cloudWorkspace.getState().locked).toBe(false);
  });
  it.each(["save", "sign-out"])(
    "unlocks and retains the document when %s fails",
    async (failure) => {
      render(gate());
      await screen.findByText("Protected workspace");
      await act(async () => {
        await cloudWorkspace.load("a");
      });
      act(() => {
        useDiagramStore.getState().addNode(node);
      });
      const snapshot = diagramDataSchema.parse(useDiagramStore.getState().exportDiagram());
      const update = vi.spyOn(diagramsApi, "update");
      if (failure === "save") {
        update.mockRejectedValue(new Error("Offline"));
      } else {
        update.mockResolvedValue({ ...diagram, data: snapshot, revision: 2 });
        clerk.signOut.mockRejectedValue(new Error("Clerk unavailable"));
      }
      fireEvent.click(screen.getByText("Sign out"));
      await screen.findByText(
        "Could not sign out. Your edits are still available; retry when ready.",
      );
      expect(cloudWorkspace.getState().locked).toBe(false);
      expect(useDiagramStore.getState().exportDiagram()).toEqual(snapshot);
      expect(clerk.signOut).toHaveBeenCalledTimes(failure === "save" ? 0 : 1);
      expect(cloudWorkspace.getState().dirty).toBe(failure === "save");
      act(() => {
        useDiagramStore.getState().updateNodeData(node.id, { label: "Editable again" });
      });
      expect(useDiagramStore.getState().nodes[0]?.data["label"]).toBe("Editable again");
    },
  );
  it("rejects an old token result after the authenticated account changes", async () => {
    const view = render(gate());
    await screen.findByText("Protected workspace");
    await act(async () => {
      await cloudWorkspace.load("a");
    });
    act(() => {
      useDiagramStore.getState().addNode(node);
    });
    const token = deferred<string>();
    auth.getToken.mockReturnValueOnce(token.promise);
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    const request = projectsApi.list();
    auth.userId = "bob";
    view.rerender(gate());
    await screen.findByRole("alert", { name: "Unsaved workspace recovery" });
    token.resolve("stale-token");
    await expect(request).rejects.toThrow("Sign in");
    expect(fetcher).not.toHaveBeenCalled();
    expect(cloudWorkspace.getState().dirty).toBe(true);
  });
  it("blocks the new account without destroying or exposing the previous owner's edits", async () => {
    const view = render(gate());
    await waitFor(() => expect(screen.queryByText("Loading workspace…")).toBeNull());
    await act(async () => {
      await cloudWorkspace.load("a");
    });
    act(() => {
      cloudWorkspace.schedule(data);
    });
    auth.userId = "bob";
    view.rerender(gate());
    await waitFor(() => expect(screen.queryByText("Loading workspace…")).toBeNull());
    expect(
      await screen.findByRole("alert", { name: "Unsaved workspace recovery" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Protected workspace")).toBeNull();
    expect(screen.queryByText("Retry saving edits")).toBeNull();
    expect(screen.queryByText("Download recovery JSON")).toBeNull();
    expect(cloudWorkspace.getState()).toMatchObject({
      diagram: { id: "a" },
      dirty: true,
      locked: true,
    });
    await expect(cloudWorkspace.flush()).rejects.toThrow("original account");
    await expect(projectsApi.list()).rejects.toThrow("Sign in");

    fireEvent.click(screen.getByText("Discard edits and continue"));
    fireEvent.click(screen.getByText("Keep edits"));
    expect(cloudWorkspace.getState().dirty).toBe(true);
    fireEvent.click(screen.getByText("Discard edits and continue"));
    fireEvent.click(screen.getByText("Confirm discard and continue"));
    await screen.findByText("Protected workspace");
    expect(cloudWorkspace.getState().diagram).toBeNull();
    expect(useDiagramStore.getState().nodes).toEqual([]);
    expect(useDiagramStore.getState().history).toEqual([]);
  });
});
