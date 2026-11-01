import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChoiceButton } from "./ChoiceButton";

afterEach(cleanup);

describe("ChoiceButton", () => {
  it("is a pressed toggle with a ring while selected", () => {
    render(
      <ChoiceButton selected onClick={() => {}}>
        Backend
      </ChoiceButton>,
    );

    const button = screen.getByRole("button", { name: "Backend", pressed: true });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("border-primary", "ring-1");
    expect(button).not.toHaveClass("border-border");
  });

  it("is an unpressed toggle without a ring while not selected", () => {
    render(
      <ChoiceButton selected={false} onClick={() => {}}>
        Frontend
      </ChoiceButton>,
    );

    const button = screen.getByRole("button", { name: "Frontend", pressed: false });
    expect(button).toHaveClass("border-border");
    expect(button).not.toHaveClass("border-primary");
  });

  it("calls onClick once per click", () => {
    const onClick = vi.fn<() => void>();
    render(
      <ChoiceButton selected={false} onClick={onClick}>
        Full stack
      </ChoiceButton>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Full stack" }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
