import { afterEach, describe, expect, it } from "vite-plus/test";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { DesignDecision } from "@/types";
import { DesignDecisionSummary } from "./DesignDecisionSummary";

const decision: DesignDecision = {
  choice: "Redis cache-aside",
  reason: "Most reads repeat within a minute.",
  benefits: ["Fewer database reads", "Faster page loads"],
  drawbacks: ["Reads can be up to 60 s stale"],
  considered: [{ option: "Read replicas", whyNot: "More to operate for this load" }],
  revisitWhen: ["Reads must always be current"],
};

afterEach(cleanup);

describe("DesignDecisionSummary", () => {
  it.each([false, true])(
    "leads with the choice and why, then lists each section as items (compact=%s)",
    (compact) => {
      const { container } = render(<DesignDecisionSummary value={decision} compact={compact} />);
      const paragraphs = container.querySelectorAll("p");
      expect(paragraphs[0]).toHaveTextContent("Chose Redis cache-aside");
      expect(paragraphs[1]).toHaveTextContent("Most reads repeat within a minute.");
      const gains = screen.getByRole("region", { name: "Gains" });
      expect(
        within(gains)
          .getAllByRole("listitem")
          .map((item) => item.textContent),
      ).toEqual(["+Fewer database reads", "+Faster page loads"]);
      expect(
        within(screen.getByRole("region", { name: "Costs" })).getByRole("listitem"),
      ).toHaveTextContent("Reads can be up to 60 s stale");
      expect(
        within(screen.getByRole("region", { name: "Considered instead" })).getByRole("listitem")
          .textContent,
      ).toBe("Read replicas — More to operate for this load");
      expect(
        within(screen.getByRole("region", { name: "Revisit when" })).getByRole("listitem"),
      ).toHaveTextContent("Reads must always be current");
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    },
  );

  it("colours gains and costs only through the tradeoff tokens", () => {
    const { container } = render(<DesignDecisionSummary value={decision} />);
    const classes = Array.from(container.querySelectorAll("[class]"), (el) => el.className);
    expect(classes.join(" ")).toMatch(/\btext-tradeoff-gain\b/);
    expect(classes.join(" ")).toMatch(/\btext-tradeoff-cost\b/);
    expect(classes.join(" ")).not.toMatch(
      /\b(?:text|bg|border)-(?:green|red|emerald|amber|lime|rose|blue|success|destructive)\b/,
    );
  });

  it.each([
    undefined,
    {},
    { choice: " ", reason: "\n", benefits: ["", " "], considered: [{ option: " " }] },
  ])("shows the empty state when nothing meaningful is documented: %j", (value) => {
    const { container } = render(<DesignDecisionSummary value={value} />);
    expect(screen.getByText("No decision documented yet.")).toBeVisible();
    expect(container.querySelector("ul")).not.toBeInTheDocument();
  });

  it("omits empty sections and blank items without inventing headings", () => {
    render(
      <DesignDecisionSummary
        value={{ choice: "  Redis  ", benefits: ["", "Fast reads"], drawbacks: [" "] }}
      />,
    );
    expect(screen.getByText("Redis")).toBeVisible();
    expect(
      within(screen.getByRole("region", { name: "Gains" })).getAllByRole("listitem"),
    ).toHaveLength(1);
    for (const name of ["Costs", "Considered instead", "Revisit when"]) {
      expect(screen.queryByRole("region", { name })).not.toBeInTheDocument();
    }
  });

  it("keeps long items fully readable without truncation", () => {
    const drawback = `Potential stale reads\n${"More invalidation work. ".repeat(30)}`.trim();
    const { container } = render(
      <DesignDecisionSummary value={{ drawbacks: [drawback] }} compact />,
    );
    const item = within(screen.getByRole("region", { name: "Costs" })).getByText(drawback, {
      normalizer: (text) => text,
    });
    expect(item.textContent).toBe(drawback);
    expect(item).toHaveClass("whitespace-pre-wrap", "wrap-anywhere");
    expect(
      container.querySelector(".line-clamp-2, .line-clamp-3, .truncate"),
    ).not.toBeInTheDocument();
  });
});
