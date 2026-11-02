import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { act, cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VersionsPanel } from "./VersionsPanel";
import { workspaceQuery } from "@/services/workspaceQuery";
import { cloudWorkspace } from "@/services/cloudWorkspace";
import { useAiDesignStore } from "@/store/aiDesignStore";
import type { ApiDiagramVersion } from "@/services/api";

const version = {
  id: "v1",
  versionNumber: 1,
  label: null,
  createdAt: "2026-11-01T00:00:00.000Z",
} as unknown as ApiDiagramVersion;

beforeEach(() => {
  useAiDesignStore.setState(useAiDesignStore.getInitialState());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useAiDesignStore.getState().cancel();
});

function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(workspaceQuery.versions("d1").queryKey, [version]);
  render(
    <QueryClientProvider client={client}>
      <VersionsPanel isOpen onClose={vi.fn<() => void>()} diagramId="d1" />
    </QueryClientProvider>,
  );
}

describe("restoring a version during an AI run", () => {
  it("disables Restore only while a run is in progress", () => {
    mount();
    const restore = screen.getByRole("button", { name: /Restore/ });
    expect(restore).toBeEnabled();

    act(() => {
      useAiDesignStore.getState().start("d1");
    });
    expect(restore).toBeDisabled();

    act(() => {
      useAiDesignStore.getState().finish();
    });
    expect(restore).toBeEnabled();
  });

  it("never restores when a run starts after the confirmation prompt", () => {
    const restore = vi
      .spyOn(cloudWorkspace, "restoreVersion")
      .mockRejectedValue(new Error("unused"));
    mount();
    screen.getByRole("button", { name: /Restore/ }).click();
    act(() => {
      useAiDesignStore.getState().start("d1");
    });
    const confirm = screen.getByRole("button", { name: "Yes" });
    expect(confirm).toBeDisabled();
    confirm.click();
    expect(restore).not.toHaveBeenCalled();
  });
});
