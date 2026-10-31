import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { LoadFailure } from "@/services/cloudPersistence";
import { DiagramLoadError } from "./DiagramLoadError";

afterEach(cleanup);

function mount(failure: LoadFailure | undefined, onRetry = vi.fn<() => void>()) {
  render(
    <MemoryRouter>
      <DiagramLoadError failure={failure} message="Details for the person." onRetry={onRetry} />
    </MemoryRouter>,
  );
  return onRetry;
}

describe("DiagramLoadError", () => {
  it("offers retry only when the workspace was unreachable", async () => {
    const onRetry = mount("unavailable");
    expect(screen.getByRole("heading", { name: "Couldn't load this diagram" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Back to projects" })).toHaveAttribute("href", "/");
  });

  it.each([
    ["unreadable", "This diagram can't be opened"],
    ["missing", "Diagram not found"],
  ] as const)("explains a %s diagram without a pointless retry", (failure, title) => {
    mount(failure);
    expect(screen.getByRole("alert")).toHaveTextContent("Details for the person.");
    expect(screen.getByRole("heading", { name: title })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to projects" })).toBeVisible();
  });
});
