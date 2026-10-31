import { afterEach, describe, expect, it } from "vite-plus/test";
import { cleanup, render, screen } from "@testing-library/react";
import { Tooltip } from "./Tooltip";

afterEach(cleanup);

describe("Tooltip", () => {
  it("centers on its trigger by default", () => {
    render(
      <Tooltip content="Undo">
        <button type="button">U</button>
      </Tooltip>,
    );
    expect(screen.getByText("Undo")).toHaveClass("left-1/2", "-translate-x-1/2");
  });

  it("anchors to the trigger's right edge so edge tooltips open inward", () => {
    render(
      <Tooltip content="Copy private link" align="end">
        <button type="button">S</button>
      </Tooltip>,
    );
    const tip = screen.getByText("Copy private link");
    expect(tip).toHaveClass("right-0");
    expect(tip).not.toHaveClass("left-1/2");
  });
});
