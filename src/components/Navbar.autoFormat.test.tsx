import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { Navbar } from "./Navbar";

const command = vi.hoisted(() => ({ autoFormat: vi.fn<() => void>(), disabled: false }));
vi.mock("@/hooks/useAutoFormat", () => ({ useAutoFormat: () => command }));
vi.mock("@/components/CloudAuth", () => ({ AccountControls: () => null }));

beforeEach(() => {
  command.autoFormat.mockClear();
  command.disabled = false;
});
afterEach(cleanup);

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("auto format toolbar action", () => {
  it("runs the shared command directly with no direction menu", () => {
    mount();
    const button = screen.getByRole("button", { name: "Auto format" });

    fireEvent.click(button);

    expect(command.autoFormat).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Top to Bottom")).not.toBeInTheDocument();
    expect(screen.queryByText("Left to Right")).not.toBeInTheDocument();
    expect(button).not.toHaveAttribute("aria-haspopup");
  });

  it("disables formatting when the shared command is unavailable", () => {
    command.disabled = true;
    mount();
    const button = screen.getByRole("button", { name: "Auto format" });

    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(command.autoFormat).not.toHaveBeenCalled();
  });
});
