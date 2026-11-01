import { afterEach, describe, expect, it } from "vite-plus/test";
import { cleanup, render, screen, within } from "@testing-library/react";
import { TradeoffList } from "./TradeoffList";

afterEach(cleanup);

describe("TradeoffList", () => {
  it("labels the two sides Gains and Costs", () => {
    render(<TradeoffList gains={["Fast"]} costs={["Stale reads"]} />);
    expect(screen.getByRole("region", { name: "Gains" })).toHaveTextContent("Fast");
    expect(screen.getByRole("region", { name: "Costs" })).toHaveTextContent("Stale reads");
  });

  it("marks items with + and − so meaning does not rely on colour", () => {
    render(<TradeoffList gains={["Fast", "Cheap"]} costs={["Stale reads"]} />);
    const markers = (name: string) =>
      Array.from(
        screen.getByRole("region", { name }).querySelectorAll<HTMLElement>("[aria-hidden='true']"),
      );
    const gains = markers("Gains");
    const costs = markers("Costs");
    expect(gains.map((marker) => marker.textContent)).toEqual(["+", "+"]);
    expect(costs.map((marker) => marker.textContent)).toEqual(["−"]);
    expect(gains.every((marker) => marker.classList.contains("text-tradeoff-gain"))).toBe(true);
    expect(costs.every((marker) => marker.classList.contains("text-tradeoff-cost"))).toBe(true);
  });

  it("gives each item a 2px leading rule in its side colour and normal foreground text", () => {
    render(<TradeoffList gains={["Fast"]} costs={["Stale reads"]} />);
    const gain = within(screen.getByRole("region", { name: "Gains" })).getByRole("listitem");
    const cost = within(screen.getByRole("region", { name: "Costs" })).getByRole("listitem");
    expect(gain).toHaveClass("border-l-2", "border-tradeoff-gain", "text-foreground");
    expect(cost).toHaveClass("border-l-2", "border-tradeoff-cost", "text-foreground");
  });

  it("omits an empty side", () => {
    const { container } = render(<TradeoffList gains={["Fast"]} costs={[]} />);
    expect(screen.getByRole("region", { name: "Gains" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Costs" })).not.toBeInTheDocument();
    expect(container.firstElementChild).not.toHaveClass("@xs:grid-cols-2");
  });

  it("renders nothing when both sides are empty", () => {
    const { container } = render(<TradeoffList gains={[]} costs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("sits the sides next to each other only when both are present", () => {
    const { container } = render(<TradeoffList gains={["Fast"]} costs={["Stale reads"]} />);
    expect(container.firstElementChild).toHaveClass("grid", "@xs:grid-cols-2");
  });

  it("keeps long items fully readable without truncation", () => {
    const cost = `Potential stale reads\n${"More invalidation work. ".repeat(30)}`.trim();
    const { container } = render(<TradeoffList gains={[]} costs={[cost]} />);
    const text = within(screen.getByRole("region", { name: "Costs" })).getByText(cost, {
      normalizer: (text) => text,
    });
    expect(text).toHaveClass("whitespace-pre-wrap", "wrap-anywhere");
    expect(
      container.querySelector(".line-clamp-2, .line-clamp-3, .truncate"),
    ).not.toBeInTheDocument();
  });
});
