import { useState } from "react";
import type { FormEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ArchitectureAttribute } from "@/types";
import { ArchitectureFactsEditor } from "./ArchitectureFactsEditor";

function mount(attributes: ArchitectureAttribute[] = []) {
  const onChange = vi.fn<(next: ArchitectureAttribute[]) => void>();
  function ControlledEditor() {
    const [current, setCurrent] = useState(attributes);
    return (
      <ArchitectureFactsEditor
        attributes={current}
        onChange={(next) => {
          onChange(next);
          setCurrent(next);
        }}
      />
    );
  }
  return { ...render(<ControlledEditor />), onChange };
}

function fill(name: string, value: string, unit = "") {
  fireEvent.change(screen.getByLabelText("Attribute name"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Attribute value"), { target: { value } });
  fireEvent.change(screen.getByLabelText("Attribute unit"), { target: { value: unit } });
}

function add() {
  fireEvent.click(screen.getByRole("button", { name: "Add attribute" }));
}

afterEach(cleanup);

describe("ArchitectureFactsEditor", () => {
  it("adds explicit units and keeps the existing attributes intact", () => {
    const existing = { name: "Replicas", value: "3", unit: "replicas" };
    const { onChange } = mount([existing]);
    fill(" TTL ", " 60 ", " s ");
    add();
    expect(onChange).toHaveBeenLastCalledWith([existing, { name: "TTL", value: "60", unit: "s" }]);
    expect(screen.getByLabelText("Attribute name")).toHaveValue("");
    expect(screen.getByLabelText("Attribute value")).toHaveValue("");
    expect(screen.getByLabelText("Attribute unit")).toHaveValue("");
  });

  it("accepts textual policies without units and does not split freeform values", () => {
    const { onChange } = mount();
    fill("Consistency", "read your writes");
    add();
    fill("TTL", "60s");
    add();
    expect(onChange).toHaveBeenLastCalledWith([
      { name: "Consistency", value: "read your writes" },
      { name: "TTL", value: "60s" },
    ]);
  });

  it.each(["60", "0", "-1", "+2.5", ".5", "1e3"])(
    "rejects ambiguous numeric input %s until a unit is supplied",
    (value) => {
      const { onChange } = mount();
      fill("Capacity", value);
      add();
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent("explicit unit");
      expect(screen.getByLabelText("Attribute unit")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByLabelText("Attribute unit")).toHaveAccessibleDescription(/explicit unit/);
      fireEvent.change(screen.getByLabelText("Attribute unit"), { target: { value: "count" } });
      add();
      expect(onChange).toHaveBeenLastCalledWith([{ name: "Capacity", value, unit: "count" }]);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  it.each([
    ["", "eventual", "attribute name"],
    ["  ", "eventual", "attribute name"],
    ["Policy", "", "attribute value"],
    ["Policy", "  ", "attribute value"],
  ])("rejects blank input %j, %j", (name, value, message) => {
    const { onChange } = mount();
    fill(name, value);
    add();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(message);
  });

  it("rejects duplicate names regardless of case or surrounding spaces", () => {
    const { onChange } = mount([{ name: "TTL", value: "60", unit: "s" }]);
    fill(" ttl ", "30", "s");
    add();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("already exists");
  });

  it("offers unit suggestions while accepting custom units", () => {
    const { container, onChange } = mount();
    const unitInput = screen.getByLabelText("Attribute unit");
    expect(unitInput.getAttribute("list")).toBe(container.querySelector("datalist")?.id);
    expect(Array.from(container.querySelectorAll("option"), (option) => option.value)).toEqual(
      expect.arrayContaining(["ms", "s", "MiB", "requests/s", "count", "replicas"]),
    );
    fill("Capacity", "12", "shards");
    add();
    expect(onChange).toHaveBeenLastCalledWith([{ name: "Capacity", value: "12", unit: "shards" }]);
  });

  it("rejects invalid unit strings through the schema", () => {
    const { onChange } = mount();
    fill("Capacity", "12", "x".repeat(65));
    add();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("at most 64");
  });

  it("edits a value without dropping its unit, then edits the unit without dropping the value", () => {
    const policy = { name: "Policy", value: "eventual" };
    const { onChange } = mount([{ name: "TTL", value: "60", unit: "s" }, policy]);
    fireEvent.change(screen.getByLabelText("Value for TTL"), { target: { value: "90" } });
    expect(onChange).toHaveBeenLastCalledWith([{ name: "TTL", value: "90", unit: "s" }, policy]);
    fireEvent.change(screen.getByLabelText("Unit for TTL"), { target: { value: "ms" } });
    expect(onChange).toHaveBeenLastCalledWith([{ name: "TTL", value: "90", unit: "ms" }, policy]);
    fireEvent.click(screen.getByRole("button", { name: "Remove Policy" }));
    expect(onChange).toHaveBeenLastCalledWith([{ name: "TTL", value: "90", unit: "ms" }]);
    expect(screen.queryByLabelText("Value for Policy")).not.toBeInTheDocument();
  });

  it("keeps invalid value edits as drafts and recovers when a valid value is entered", () => {
    const { onChange } = mount([{ name: "TTL", value: "60", unit: "s" }]);
    fireEvent.change(screen.getByLabelText("Value for TTL"), { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Value for TTL")).toHaveValue("");
    expect(screen.getByLabelText("Value for TTL")).toHaveAccessibleDescription(/attribute value/);
    fireEvent.change(screen.getByLabelText("Value for TTL"), { target: { value: "30" } });
    expect(onChange).toHaveBeenLastCalledWith([{ name: "TTL", value: "30", unit: "s" }]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not commit removal of a numeric value's unit", () => {
    const { onChange } = mount([{ name: "TTL", value: "60", unit: "s" }]);
    fireEvent.change(screen.getByLabelText("Unit for TTL"), { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("explicit unit");
    fireEvent.change(screen.getByLabelText("Unit for TTL"), { target: { value: "min" } });
    expect(onChange).toHaveBeenLastCalledWith([{ name: "TTL", value: "60", unit: "min" }]);
  });

  it("can remove a textual value's unit entirely", () => {
    const { onChange } = mount([{ name: "Policy", value: "eventual", unit: "policy" }]);
    fireEvent.change(screen.getByLabelText("Unit for Policy"), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith([{ name: "Policy", value: "eventual" }]);
  });

  it("preserves legacy numeric values while editing other rows or deleting", () => {
    const legacy = { name: "Replicas", value: "3" };
    const { onChange } = mount([legacy, { name: "TTL", value: "60s" }]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Value for TTL"), { target: { value: "30s" } });
    expect(onChange).toHaveBeenLastCalledWith([legacy, { name: "TTL", value: "30s" }]);
    fireEvent.click(screen.getByRole("button", { name: "Remove TTL" }));
    expect(onChange).toHaveBeenLastCalledWith([legacy]);
  });

  it("reflects externally updated row values and units", () => {
    const onChange = vi.fn<(next: ArchitectureAttribute[]) => void>();
    const { rerender } = render(
      <ArchitectureFactsEditor
        attributes={[{ name: "TTL", value: "60", unit: "s" }]}
        onChange={onChange}
      />,
    );
    rerender(
      <ArchitectureFactsEditor
        attributes={[{ name: "TTL", value: "90", unit: "ms" }]}
        onChange={onChange}
      />,
    );
    expect(screen.getByLabelText("Value for TTL")).toHaveValue("90");
    expect(screen.getByLabelText("Unit for TTL")).toHaveValue("ms");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("stops editor shortcuts and adds on Enter without submitting an enclosing form", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn<(event: Event) => void>();
    const onKeyUp = vi.fn<(event: Event) => void>();
    const onSubmit = vi.fn<(event: FormEvent<HTMLFormElement>) => void>((event) =>
      event.preventDefault(),
    );
    const onChange = vi.fn<(next: ArchitectureAttribute[]) => void>();
    render(
      <form onSubmit={onSubmit}>
        <ArchitectureFactsEditor
          attributes={[{ name: "TTL", value: "60", unit: "s" }]}
          onChange={onChange}
        />
      </form>,
    );
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    for (const label of [
      "Attribute name",
      "Attribute value",
      "Attribute unit",
      "Value for TTL",
      "Unit for TTL",
    ]) {
      const input = screen.getByLabelText(label);
      fireEvent.keyDown(input, { key: "Delete" });
      fireEvent.keyUp(input, { key: "Delete" });
    }
    fill("Policy", "eventual");
    await user.click(screen.getByLabelText("Attribute value"));
    await user.keyboard("{Enter}");
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onKeyDown).not.toHaveBeenCalled();
    expect(onKeyUp).not.toHaveBeenCalled();
  });

  it("does not add an attribute while composing text", () => {
    const { onChange } = mount();
    fill("Policy", "eventual");
    fireEvent.keyDown(screen.getByLabelText("Attribute value"), {
      key: "Enter",
      isComposing: true,
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
