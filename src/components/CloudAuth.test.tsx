import { beforeEach, afterEach, describe, expect, it, vi } from "vite-plus/test";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { StrictMode, Suspense, lazy, useEffect } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
const auth = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: true,
  userId: "alice",
  getToken: vi.fn<() => Promise<string | null>>(),
}));
vi.mock("@clerk/react", () => ({
  useAuth: () => auth,
  useClerk: () => ({ signOut: vi.fn<() => Promise<void>>() }),
  ClerkProvider: ({ children }: { children: import("react").ReactNode }) => children,
  SignIn: () => <p>Sign-in panel</p>,
  SignUp: () => <p>Sign-up panel</p>,
}));
import { CloudAuth, RequireAuth } from "./CloudAuth";
import { cloudWorkspace } from "@/services/cloudWorkspace";
import { diagramsApi, projectsApi, type ApiDiagram } from "@/services/api";
import { useDiagramStore } from "@/store/diagramStore";
import { diagramDataSchema } from "@/schemas/diagram";
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
  auth.isSignedIn = true;
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
      <RequireAuth />
    </MemoryRouter>
  </CloudAuth>
);
describe("cloud authentication transitions", () => {
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
  it("clears private clipboard and health results when the account changes", async () => {
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
    expect(useDiagramStore.getState().healthCheckResults).toEqual({});
  });
  it("does not expose the previous account's in-memory document to a new account", async () => {
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
    expect(cloudWorkspace.getState().diagram).toBeNull();
    expect(useDiagramStore.getState().nodes).toEqual([]);
  });
});
