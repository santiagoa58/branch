import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { JoinDiagramDialog } from "./JoinDiagramDialog";

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("collaboration identity", () => {
  it("rejects invalid stored names before using them", () => {
    vi.spyOn(localStorage, "getItem").mockReturnValue("x".repeat(31));
    render(<JoinDiagramDialog open onJoin={() => {}} />);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("does not join or save an invalid name entered through the DOM", () => {
    const joined: string[] = [];
    render(<JoinDiagramDialog open onJoin={(name) => joined.push(name)} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "x".repeat(31) } });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(joined).toEqual([]);
    expect(vi.spyOn(localStorage, "setItem")).not.toHaveBeenCalled();
  });

  it("joins with a trimmed valid name", () => {
    const joined: string[] = [];
    render(<JoinDiagramDialog open onJoin={(name) => joined.push(name)} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  Ada  " } });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(joined).toEqual(["Ada"]);
    expect(vi.spyOn(localStorage, "setItem")).toHaveBeenCalledWith(
      "archdiagram-collab-name",
      "Ada",
    );
  });
});
