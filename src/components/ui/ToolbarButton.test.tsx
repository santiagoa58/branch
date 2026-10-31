import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToolbarButton } from "./ToolbarButton";

afterEach(cleanup);

describe("ToolbarButton", () => {
  it("names itself, shows its shortcut in the tooltip and reports pressed state", async () => {
    const onClick = vi.fn<() => void>();
    render(
      <ToolbarButton label="Pan" shortcut="H" active onClick={onClick}>
        <svg aria-hidden="true" />
      </ToolbarButton>,
    );
    const button = screen.getByRole("button", { name: "Pan" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Pan (H)")).toBeInTheDocument();
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("shows a visible text label for actions an icon can't explain", () => {
    render(
      <ToolbarButton
        label="Simulate requests and failures"
        showLabel="Simulate"
        onClick={vi.fn<() => void>()}
      >
        <svg aria-hidden="true" />
      </ToolbarButton>,
    );
    const button = screen.getByRole("button", { name: "Simulate requests and failures" });
    expect(button).toHaveTextContent("Simulate");
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Simulate requests and failures")).toBeInTheDocument();
  });
});
