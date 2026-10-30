import { afterEach, describe, expect, it } from "vite-plus/test";
import { cleanup, render, screen } from "@testing-library/react";
import { Brand, BrandMark } from "./Brand";

afterEach(cleanup);

describe("Branch branding", () => {
  it("uses the canonical asset with an accessible name when shown alone", () => {
    render(<BrandMark />);

    const mark = screen.getByRole("img", { name: "Branch" });
    expect(mark).toHaveAttribute("src", "/branch-mark.svg");
    expect(mark).toHaveAttribute("width", "32");
    expect(mark).toHaveAttribute("height", "32");
  });

  it("names a brand control once instead of repeating the image and wordmark", () => {
    render(
      <button type="button">
        <Brand />
      </button>,
    );

    const button = screen.getByRole("button", { name: /^Branch$/ });
    expect(button.querySelectorAll("img")).toHaveLength(1);
    expect(button.querySelector("img")).toHaveAttribute("src", "/branch-mark.svg");
    expect(button.querySelector("img")).toHaveAttribute("alt", "");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("can defer the accessible label to surrounding content", () => {
    const { container } = render(
      <>
        <Brand decorative />
        <BrandMark decorative className="size-16" />
      </>,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Branch").closest("[aria-hidden]")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(container.querySelector("img.size-16")).toHaveAttribute("alt", "");
  });
});
