import { afterEach, describe, expect, it } from "vite-plus/test";
import { cleanup, render, screen } from "@testing-library/react";
import { LoadingIndicator, LoadingState } from "./loading";

afterEach(cleanup);

describe("shared loading UI", () => {
  it("announces a default loading status without exposing decorative artwork", () => {
    render(<LoadingState variant="screen" />);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Loading Branch…");
    expect(status).toHaveClass("bg-background", "min-h-svh");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("supports contextual panel copy and layout without full-screen styling", () => {
    render(
      <LoadingState
        label="Loading versions…"
        description="Your diagram history will appear here."
        className="flex-1"
      />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading versions…");
    expect(status).toHaveTextContent("Your diagram history will appear here.");
    expect(status).toHaveClass("flex-1");
    expect(status).not.toHaveClass("min-h-svh");
    expect(screen.queryByText("Branch")).not.toBeInTheDocument();
  });

  it("keeps the inline indicator decorative so control labels remain unchanged", () => {
    render(
      <button type="button" disabled>
        <LoadingIndicator className="size-3" />
        Saving…
      </button>,
    );

    const button = screen.getByRole("button", { name: "Saving…" });
    expect(button).toBeDisabled();
    expect(button.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(button.firstElementChild).toHaveClass("size-3");
  });
});
