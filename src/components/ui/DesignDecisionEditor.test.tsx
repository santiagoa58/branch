import { useState } from "react";
import type { FormEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DesignDecision } from "@/types";
import { DECISION_LIMITS, DesignDecisionEditor } from "./DesignDecisionEditor";

const decision: DesignDecision = {
  choice: "Redis cache-aside",
  reason: "Most reads repeat within a minute.",
  benefits: ["Fewer database reads", "Faster page loads"],
  drawbacks: ["Reads can be up to 60 s stale"],
  considered: [{ option: "Read replicas", whyNot: "More to operate for this load" }],
  revisitWhen: ["Reads must always be current"],
};

function mount(value: DesignDecision | undefined = decision) {
  const onChange = vi.fn<(next: DesignDecision) => void>();
  function ControlledEditor() {
    const [current, setCurrent] = useState(value);
    return (
      <DesignDecisionEditor
        value={current}
        onChange={(next) => {
          onChange(next);
          setCurrent(next);
        }}
      />
    );
  }
  return { ...render(<ControlledEditor />), onChange };
}

afterEach(cleanup);

describe("DesignDecisionEditor", () => {
  it("shows every section with its items as separate short inputs", () => {
    mount();
    expect(screen.getByRole("heading", { name: "Decision" })).toBeVisible();
    expect(screen.getByLabelText("Chosen approach")).toHaveValue("Redis cache-aside");
    expect(screen.getByLabelText("Why")).toHaveValue("Most reads repeat within a minute.");
    expect(screen.getByLabelText("Why")).toHaveAccessibleDescription(/one sentence/i);
    expect(screen.getByRole("textbox", { name: "Benefits 1" })).toHaveValue("Fewer database reads");
    expect(screen.getByRole("textbox", { name: "Benefits 2" })).toHaveValue("Faster page loads");
    expect(screen.getByRole("textbox", { name: "Drawbacks 1" })).toHaveValue(
      "Reads can be up to 60 s stale",
    );
    expect(screen.getByRole("textbox", { name: "Option 1" })).toHaveValue("Read replicas");
    expect(screen.getByRole("textbox", { name: "Why not option 1" })).toHaveValue(
      "More to operate for this load",
    );
    expect(screen.getByRole("textbox", { name: "Revisit when 1" })).toHaveValue(
      "Reads must always be current",
    );
    expect(screen.getByRole("group", { name: "Benefits" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Considered instead" })).toBeVisible();
  });

  it("caps each field at the short-entry limits", () => {
    mount();
    expect(screen.getByLabelText("Chosen approach")).toHaveAttribute(
      "maxLength",
      String(DECISION_LIMITS.choice),
    );
    expect(screen.getByLabelText("Why")).toHaveAttribute(
      "maxLength",
      String(DECISION_LIMITS.reason),
    );
    for (const name of ["Benefits 1", "Drawbacks 1", "Option 1", "Why not option 1"]) {
      expect(screen.getByRole("textbox", { name })).toHaveAttribute(
        "maxLength",
        String(DECISION_LIMITS.item),
      );
    }
  });

  it("edits one item while preserving every other field", () => {
    const original = structuredClone(decision);
    const { onChange } = mount(original);
    fireEvent.change(screen.getByRole("textbox", { name: "Benefits 2" }), {
      target: { value: "Lower p95 latency" },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      ...decision,
      benefits: ["Fewer database reads", "Lower p95 latency"],
    });
    expect(original).toEqual(decision);
  });

  it("adds, fills and removes list items", async () => {
    const user = userEvent.setup();
    const { onChange } = mount();
    await user.click(screen.getByRole("button", { name: "Add drawback" }));
    expect(onChange).toHaveBeenLastCalledWith({
      ...decision,
      drawbacks: ["Reads can be up to 60 s stale", ""],
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Drawbacks 2" }), {
      target: { value: "Cache to operate" },
    });
    await user.click(screen.getByRole("button", { name: "Remove benefit 1" }));
    expect(onChange).toHaveBeenLastCalledWith({
      ...decision,
      benefits: ["Faster page loads"],
      drawbacks: ["Reads can be up to 60 s stale", "Cache to operate"],
    });
  });

  it("keeps the remaining row's input element when an earlier row is removed", async () => {
    const user = userEvent.setup();
    mount();
    const second = screen.getByRole("textbox", { name: "Benefits 2" });
    second.focus();
    await user.click(screen.getByRole("button", { name: "Remove benefit 1" }));
    const remaining = screen.getByRole("textbox", { name: "Benefits 1" });
    expect(remaining).toBe(second);
    expect(remaining).toHaveValue("Faster page loads");
  });

  it("resyncs rows when the decision changes from outside, such as undo", () => {
    const onChange = vi.fn<(next: DesignDecision) => void>();
    const { rerender } = render(<DesignDecisionEditor value={decision} onChange={onChange} />);
    rerender(
      <DesignDecisionEditor value={{ ...decision, benefits: ["Only one"] }} onChange={onChange} />,
    );
    expect(screen.getByRole("textbox", { name: "Benefits 1" })).toHaveValue("Only one");
    expect(screen.queryByRole("textbox", { name: "Benefits 2" })).not.toBeInTheDocument();
    rerender(<DesignDecisionEditor value={decision} onChange={onChange} />);
    expect(screen.getByRole("textbox", { name: "Benefits 2" })).toHaveValue("Faster page loads");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("adds a considered option and records why it was rejected", async () => {
    const user = userEvent.setup();
    const { onChange } = mount();
    await user.click(screen.getByRole("button", { name: "Add option" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Option 2" }), {
      target: { value: "No cache" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Why not option 2" }), {
      target: { value: "Primary saturates at peak" },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      ...decision,
      considered: [
        { option: "Read replicas", whyNot: "More to operate for this load" },
        { option: "No cache", whyNot: "Primary saturates at peak" },
      ],
    });
    await user.click(screen.getByRole("button", { name: "Remove option 1" }));
    expect(onChange).toHaveBeenLastCalledWith({
      ...decision,
      considered: [{ option: "No cache", whyNot: "Primary saturates at peak" }],
    });
  });

  it("drops a section entirely once its last item is removed", async () => {
    const user = userEvent.setup();
    const { onChange } = mount();
    await user.click(screen.getByRole("button", { name: "Remove revisit trigger 1" }));
    const { revisitWhen: _revisitWhen, ...rest } = decision;
    expect(onChange).toHaveBeenLastCalledWith(rest);
  });

  it("starts empty for an undocumented decision and only writes what was entered", () => {
    const onChange = vi.fn<(next: DesignDecision) => void>();
    render(<DesignDecisionEditor value={undefined} onChange={onChange} />);
    expect(screen.getByLabelText("Chosen approach")).toHaveValue("");
    expect(screen.queryByRole("textbox", { name: "Benefits 1" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Chosen approach"), { target: { value: "Redis" } });
    expect(onChange).toHaveBeenLastCalledWith({ choice: "Redis" });
  });

  it("reflects external decision changes without emitting edits", () => {
    const onChange = vi.fn<(next: DesignDecision) => void>();
    const { rerender } = render(<DesignDecisionEditor value={decision} onChange={onChange} />);
    rerender(<DesignDecisionEditor value={{ reason: "Keep it simple" }} onChange={onChange} />);
    expect(screen.getByLabelText("Chosen approach")).toHaveValue("");
    expect(screen.getByLabelText("Why")).toHaveValue("Keep it simple");
    expect(screen.queryByRole("textbox", { name: "Benefits 1" })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("isolates editor shortcuts and never submits a surrounding form", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn<(event: Event) => void>();
    const onKeyUp = vi.fn<(event: Event) => void>();
    const onSubmit = vi.fn<(event: FormEvent<HTMLFormElement>) => void>((event) =>
      event.preventDefault(),
    );
    function ControlledEditor() {
      const [value, setValue] = useState<DesignDecision>(decision);
      return <DesignDecisionEditor value={value} onChange={setValue} />;
    }
    render(
      <form onSubmit={onSubmit}>
        <ControlledEditor />
      </form>,
    );
    await user.tab();
    expect(screen.getByLabelText("Chosen approach")).toHaveFocus();
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    try {
      await user.keyboard("{Enter}");
      await user.click(screen.getByRole("textbox", { name: "Benefits 1" }));
      await user.keyboard("{Enter}");
      await user.click(screen.getByLabelText("Why"));
      await user.keyboard("{End}{Enter}Second line");
      expect(screen.getByLabelText("Why")).toHaveValue(
        "Most reads repeat within a minute.\nSecond line",
      );
      for (const input of screen.getAllByRole("textbox")) {
        for (const key of ["Delete", "Backspace", "Escape", "z"]) {
          fireEvent.keyDown(input, { key, ctrlKey: key === "z" });
          fireEvent.keyUp(input, { key, ctrlKey: key === "z" });
        }
      }
    } finally {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
    }
    expect(onKeyDown).not.toHaveBeenCalled();
    expect(onKeyUp).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
