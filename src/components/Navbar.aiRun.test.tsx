import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Navbar } from "./Navbar";
import { useAiDesignStore } from "@/store/aiDesignStore";

vi.mock("@/hooks/useAutoFormat", () => ({
  useAutoFormat: () => ({ autoFormat: vi.fn<() => void>(), disabled: false }),
}));
vi.mock("@/components/CloudAuth", () => ({ AccountControls: () => null }));

beforeEach(() => {
  useAiDesignStore.setState(useAiDesignStore.getInitialState());
});
afterEach(() => {
  cleanup();
  useAiDesignStore.getState().cancel();
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/projects/p1/diagrams/d1"]}>
        <Routes>
          <Route path="/projects/:projectId/diagrams/:diagramId" element={<Navbar />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("version controls during an AI run", () => {
  it("disables saving a version only while a run is in progress", () => {
    mount();
    const save = screen.getByRole("button", { name: "Save version snapshot" });
    expect(save).toBeEnabled();

    act(() => {
      useAiDesignStore.getState().start("d1");
    });
    expect(save).toBeDisabled();

    act(() => {
      useAiDesignStore.getState().finish();
    });
    expect(save).toBeEnabled();
  });

  it("disables the Save version item in the More menu during a run", () => {
    act(() => {
      useAiDesignStore.getState().start("d1");
    });
    mount();
    fireEvent.click(screen.getByRole("button", { name: /more/i }));
    expect(screen.getByRole("menuitem", { name: "Save version" })).toBeDisabled();
  });
});
