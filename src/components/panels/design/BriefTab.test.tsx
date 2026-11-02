import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vite-plus/test";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DesignBrief } from "@/schemas/aiDesign";
import { cloudWorkspace } from "@/services/cloudWorkspace";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useDiagramStore } from "@/store/diagramStore";
import { useUIStore } from "@/store/uiStore";
import {
  answerQuestion,
  bringIntoScope,
  changeAssumption,
  confirmAssumption,
  createBrief,
  removeDerivedRequirement,
  requirementsInput,
} from "@/utils/aiDesign/inputs";
import { BriefTab } from "./BriefTab";

const pipeline = vi.hoisted(() => ({
  update: vi.fn<() => Promise<void>>(),
  regenerateDecision: vi.fn<(nodeId: string) => Promise<void>>(),
  generateDataModel: vi.fn<() => Promise<void>>(),
  retry: vi.fn<(stage: string) => Promise<void>>(),
  cancel: vi.fn<() => void>(),
}));
vi.mock("@/hooks/useDesignPipeline", () => ({ useDesignPipeline: () => pipeline }));

const NEW_ID = "00000000-0000-4000-8000-000000000000";
const newId = () => NEW_ID;

const QUESTION = "How quickly must others see a check-off?";

const designed: DesignBrief = {
  inputs: {
    prompt: "Design a shared grocery list app for households.",
    scope: "fullstack",
    requirements: [
      { id: "r1", kind: "functional", text: "Members of a household share the same lists" },
    ],
    outOfScope: [{ id: "o1", text: "Paying for groceries" }],
    answers: [{ id: "a1", question: QUESTION, answer: "Instantly", assumed: true }],
  },
  questions: [],
  requirements: [
    { kind: "functional", text: "Add, edit and remove items" },
    { kind: "nonFunctional", text: "Serve about 1M households", category: "scale" },
  ],
  assumptions: [{ kind: "functional", text: "Members sign in with email" }],
  outOfScope: ["Recipe and meal planning"],
  ranFrom: {},
};

const asking: DesignBrief = {
  ...designed,
  inputs: { ...designed.inputs, answers: [] },
  questions: [
    {
      id: "q1",
      topic: "scale",
      question: "Roughly how many households should this serve?",
      why: "Decides between one database and partitioned storage.",
      options: [
        { label: "Up to 10k households", impact: "One database, no caching layer" },
        { label: "About 1M households", impact: "Read replicas and a cache for hot lists" },
      ],
      recommended: "About 1M households",
      allowsCustom: false,
    },
    {
      id: "q2",
      topic: "offline",
      question: "What should happen without a signal in the store?",
      why: "Offline use needs a local copy and a merge rule.",
      options: [],
      recommended: "The list keeps working offline",
      allowsCustom: true,
    },
  ],
};

let schedule: MockInstance<typeof cloudWorkspace.schedule>;

beforeEach(() => {
  useAiDesignStore.setState(useAiDesignStore.getInitialState());
  useDiagramStore.getState().resetDiagramState();
  useUIStore.setState(useUIStore.getInitialState());
  schedule = vi.spyOn(cloudWorkspace, "schedule").mockImplementation(() => {});
  vi.spyOn(crypto, "randomUUID").mockReturnValue(NEW_ID);
  for (const fn of Object.values(pipeline)) {
    fn.mockReset();
  }
  pipeline.update.mockResolvedValue();
});

afterEach(() => {
  cleanup();
  schedule.mockRestore();
  vi.restoreAllMocks();
});

function mount(brief: DesignBrief | null) {
  useDiagramStore.setState({ brief });
  return render(<BriefTab />);
}

const currentBrief = () => useDiagramStore.getState().brief;

/** The list row that shows `text`, optionally inside the named section. */
function row(text: string, section?: string): HTMLElement {
  const scope = section ? within(screen.getByRole("region", { name: section })) : screen;
  const item = scope.getByText(text).closest("li");
  if (!item) {
    throw new Error(`No row for ${text}`);
  }
  return item;
}

const box = (name: string) => screen.getByRole("textbox", { name });

describe("composer", () => {
  it("Generate design waits, with an explanation, for a prompt and a functional line", async () => {
    const user = userEvent.setup();
    mount(null);
    const generate = screen.getByRole("button", { name: "Generate design" });
    expect(generate).toBeDisabled();
    expect(generate).toHaveAccessibleDescription(
      "Describe the system and add at least one functional requirement to generate the design.",
    );

    await user.type(box("What should we design?"), "A shared grocery list");
    expect(generate).toBeDisabled();
    expect(generate).toHaveAccessibleDescription(
      "Add at least one functional requirement to generate the design.",
    );
    // Blank lines are not a requirement.
    await user.type(box("Functional requirements"), "   {Enter}{Enter}");
    expect(generate).toBeDisabled();

    await user.type(box("Functional requirements"), "Members share lists");
    expect(generate).toBeEnabled();
    expect(generate).not.toHaveAccessibleDescription();

    await user.clear(box("What should we design?"));
    expect(generate).toHaveAccessibleDescription("Describe the system to generate the design.");
    expect(pipeline.update).not.toHaveBeenCalled();
  });

  it("labels each section and ties its help text to it", () => {
    mount(null);
    for (const name of [
      "Functional requirements",
      "Non-functional requirements",
      "Constraints",
      "Out of scope",
    ]) {
      expect(box(name).getAttribute("placeholder")).toMatch(/\n/);
      expect(box(name)).toHaveAccessibleDescription(/one per line/i);
    }
    expect(box("Functional requirements")).toBeRequired();
    expect(box("What should we design?")).toBeRequired();
  });

  it("a pasted block becomes one line each, without blanks or repeats, and runs the design", async () => {
    const user = userEvent.setup();
    mount(null);
    await user.type(box("What should we design?"), "A shared grocery list");
    await user.click(screen.getByRole("button", { name: /^Backend/ }));
    expect(screen.getByRole("button", { name: /^Backend/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(box("Functional requirements"));
    await user.paste(
      "Members share lists\n\n  Check items off \nmembers share lists\nInvite members",
    );
    await user.click(box("Constraints"));
    await user.paste("Runs on AWS");
    await user.click(box("Out of scope"));
    await user.paste("Payments\nRecipes\n");

    await user.click(screen.getByRole("button", { name: "Generate design" }));

    expect(currentBrief()).toEqual(
      createBrief(
        "A shared grocery list",
        "backend",
        [
          { kind: "functional", text: "Members share lists" },
          { kind: "functional", text: "Check items off" },
          { kind: "functional", text: "Invite members" },
          { kind: "constraint", text: "Runs on AWS" },
        ],
        ["Payments", "Recipes"],
        newId,
      ),
    );
    expect(pipeline.update).toHaveBeenCalledTimes(1);
  });

  it("a non-functional preset adds its line with the category, the example selected", async () => {
    const user = userEvent.setup();
    mount(null);
    const nonFunctional = box("Non-functional requirements");
    await user.type(nonFunctional, "Scale: 1M households");
    const presets = screen.getByRole("group", { name: "Add a non-functional requirement" });
    expect(
      within(presets)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual([
      "Scale",
      "Latency",
      "Availability",
      "Consistency",
      "Durability",
      "Security",
      "Cost",
    ]);

    await user.click(screen.getByRole("button", { name: "Add a latency requirement" }));
    expect(nonFunctional).toHaveValue("Scale: 1M households\nLatency: p99 under 200 ms for reads");
    expect(nonFunctional).toHaveFocus();
    const selected = (nonFunctional as HTMLTextAreaElement).value.slice(
      (nonFunctional as HTMLTextAreaElement).selectionStart,
      (nonFunctional as HTMLTextAreaElement).selectionEnd,
    );
    expect(selected).toBe("p99 under 200 ms for reads");
    await user.keyboard("p95 under 100 ms");

    await user.type(box("What should we design?"), "A shared grocery list");
    await user.type(box("Functional requirements"), "Members share lists");
    await user.click(screen.getByRole("button", { name: "Generate design" }));

    const brief = currentBrief();
    expect(brief?.inputs.requirements).toEqual([
      { id: NEW_ID, kind: "functional", text: "Members share lists" },
      { id: NEW_ID, kind: "nonFunctional", text: "Scale: 1M households" },
      { id: NEW_ID, kind: "nonFunctional", text: "Latency: p95 under 100 ms" },
    ]);
    expect(brief && requirementsInput(brief).requirements.slice(1)).toEqual([
      { kind: "nonFunctional", text: "Scale: 1M households", category: "scale" },
      { kind: "nonFunctional", text: "Latency: p95 under 100 ms", category: "latency" },
    ]);
  });

  it("describes what each scope details", () => {
    mount(null);
    expect(screen.getByRole("button", { name: /^Full stack/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Client side in detail; the backend is one box.")).toBeVisible();
  });
});

describe("edit all", () => {
  const withLines: DesignBrief = {
    ...designed,
    inputs: {
      ...designed.inputs,
      requirements: [
        { id: "r1", kind: "functional", text: "Members of a household share the same lists" },
        { id: "r2", kind: "functional", text: "Members check items off" },
        { id: "r3", kind: "nonFunctional", text: "Latency: under a second" },
      ],
    },
  };
  const historyLength = () => useDiagramStore.getState().history.length;

  it("opens every section as one box, prefilled one line per item", async () => {
    const user = userEvent.setup();
    mount(withLines);
    await user.click(screen.getByRole("button", { name: "Edit all" }));
    const form = within(screen.getByRole("region", { name: "Edit the brief" }));
    expect(form.getByRole("textbox", { name: "What should we design?" })).toHaveValue(
      withLines.inputs.prompt,
    );
    expect(form.getByRole("textbox", { name: "Functional requirements" })).toHaveValue(
      "Members of a household share the same lists\nMembers check items off",
    );
    expect(form.getByRole("textbox", { name: "Non-functional requirements" })).toHaveValue(
      "Latency: under a second",
    );
    expect(form.getByRole("textbox", { name: "Out of scope" })).toHaveValue("Paying for groceries");
  });

  it("Update design changes many lines in one edit, keeping ids of unchanged lines", async () => {
    const user = userEvent.setup();
    mount(withLines);
    const before = historyLength();
    await user.click(screen.getByRole("button", { name: "Edit all" }));
    const functional = box("Functional requirements");
    await user.clear(functional);
    await user.click(functional);
    await user.paste(
      "Members check items off\nInvite members by email\nMembers of a household share the same lists",
    );
    await user.clear(box("Out of scope"));
    await user.click(box("Out of scope"));
    await user.paste("Paying for groceries\nRecipes");
    await user.click(screen.getByRole("button", { name: "Update design" }));

    expect(currentBrief()?.inputs.requirements).toEqual([
      { id: "r2", kind: "functional", text: "Members check items off" },
      { id: NEW_ID, kind: "functional", text: "Invite members by email" },
      { id: "r1", kind: "functional", text: "Members of a household share the same lists" },
      { id: "r3", kind: "nonFunctional", text: "Latency: under a second" },
    ]);
    expect(currentBrief()?.inputs.outOfScope).toEqual([
      { id: "o1", text: "Paying for groceries" },
      { id: NEW_ID, text: "Recipes" },
    ]);
    expect(historyLength()).toBe(before + 1);
    expect(pipeline.update).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("region", { name: "Edit the brief" })).toBeNull();
    expect(screen.getByText("Invite members by email")).toBeVisible();
  });

  it("needs a functional line, and Cancel or an unchanged form leaves the brief alone", async () => {
    const user = userEvent.setup();
    mount(withLines);
    const before = historyLength();
    await user.click(screen.getByRole("button", { name: "Edit all" }));
    await user.clear(box("Functional requirements"));
    expect(screen.getByRole("button", { name: "Update design" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Update design" })).toHaveAccessibleDescription(
      "Add at least one functional requirement to update the design.",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(currentBrief()).toEqual(withLines);

    await user.click(screen.getByRole("button", { name: "Edit all" }));
    await user.click(screen.getByRole("button", { name: "Update design" }));
    expect(currentBrief()).toEqual(withLines);
    expect(historyLength()).toBe(before);
  });
});

describe("saved open questions", () => {
  it("shows the brief without a question round-trip", () => {
    mount(asking);
    expect(screen.queryByRole("region", { name: "Questions" })).toBeNull();
    for (const name of ["Continue", "Assume the rest for me"]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    expect(screen.getByRole("region", { name: "Assumptions" })).toBeVisible();
    expect(screen.getByText("Members of a household share the same lists")).toBeVisible();
  });
});

describe("brief sections", () => {
  async function perform(label: string) {
    const user = userEvent.setup();
    mount(designed);
    switch (label) {
      case "Confirm":
        await user.click(
          within(row("Members sign in with email")).getByRole("button", { name: "Confirm" }),
        );
        return confirmAssumption(designed, 0, newId);
      case "Change": {
        await user.click(
          within(row("Members sign in with email")).getByRole("button", { name: "Change" }),
        );
        const input = screen.getByRole("textbox", { name: "Change assumption" });
        await user.clear(input);
        await user.type(input, "Members sign in with a magic link");
        await user.click(screen.getByRole("button", { name: "Save" }));
        return changeAssumption(designed, 0, "Members sign in with a magic link", newId);
      }
      case "Remove":
        await user.click(
          within(row("Add, edit and remove items")).getByRole("button", { name: "Remove" }),
        );
        return removeDerivedRequirement(designed, 0, newId);
      default:
        await user.click(
          within(row("Recipe and meal planning")).getByRole("button", {
            name: "Bring into scope",
          }),
        );
        return bringIntoScope(designed, 0, newId);
    }
  }

  it.each(["Confirm", "Change", "Remove", "Bring into scope"])(
    "%s edits the inputs",
    async (label) => {
      const expected = await perform(label);
      expect(currentBrief()).toEqual(expected);
    },
  );

  it("Change opens the assumption for editing and Cancel closes it", async () => {
    const user = userEvent.setup();
    mount(designed);
    await user.click(
      within(row("Members sign in with email")).getByRole("button", { name: "Change" }),
    );
    const input = screen.getByRole("textbox", { name: "Change assumption" });
    expect(input).toHaveValue("Members sign in with email");
    expect(input).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox", { name: "Change assumption" })).not.toBeInTheDocument();
    expect(currentBrief()?.inputs.requirements).toHaveLength(1);
  });

  it("confirms or changes an assumed answer", async () => {
    const user = userEvent.setup();
    mount(designed);
    const assumed = row("Instantly");
    expect(within(assumed).getByText(QUESTION)).toBeVisible();
    await user.click(within(assumed).getByRole("button", { name: "Confirm" }));
    expect(currentBrief()).toEqual(answerQuestion(designed, QUESTION, "Instantly", newId));
    // A confirmed answer is no longer an assumption.
    expect(screen.queryByText("Instantly")).not.toBeInTheDocument();

    cleanup();
    mount(designed);
    await user.click(within(row("Instantly")).getByRole("button", { name: "Change" }));
    const input = screen.getByRole("textbox", { name: "Change assumed answer" });
    await user.clear(input);
    await user.type(input, "Within a minute");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(currentBrief()).toEqual(answerQuestion(designed, QUESTION, "Within a minute", newId));
  });

  it("a row's action works once until stage 1 runs again", () => {
    mount(designed);
    const confirm = within(row("Members sign in with email")).getByRole("button", {
      name: "Confirm",
    });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(currentBrief()?.inputs.requirements).toHaveLength(2);
    const assumption = row("Members sign in with email", "Assumptions");
    expect(within(assumption).queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
    expect(within(assumption).getByText("Confirmed")).toBeVisible();
  });

  it("a row's status follows undo and redo", async () => {
    const user = userEvent.setup();
    useDiagramStore.getState().hydrateDiagram({ nodes: [], edges: [], brief: designed });
    render(<BriefTab />);
    const assumption = () => row("Members sign in with email", "Assumptions");

    for (let cycle = 0; cycle < 2; cycle += 1) {
      await user.click(within(assumption()).getByRole("button", { name: "Confirm" }));
      expect(within(assumption()).getByText("Confirmed")).toBeVisible();
      act(() => useDiagramStore.getState().undo());
      expect(within(assumption()).getByRole("button", { name: "Confirm" })).toBeVisible();
      expect(currentBrief()?.inputs.requirements).toHaveLength(1);
    }

    act(() => useDiagramStore.getState().redo());
    expect(within(assumption()).getByText("Confirmed")).toBeVisible();
  });

  it("derived rows show what was done with them", async () => {
    const user = userEvent.setup();
    mount(designed);
    await user.click(
      within(row("Add, edit and remove items", "Functional requirements")).getByRole("button", {
        name: "Remove",
      }),
    );
    expect(
      within(row("Add, edit and remove items", "Functional requirements")).getByText(
        "Moved out of scope",
      ),
    ).toBeVisible();
    await user.click(
      within(row("Recipe and meal planning", "Out of scope")).getByRole("button", {
        name: "Bring into scope",
      }),
    );
    expect(
      within(row("Recipe and meal planning", "Out of scope")).getByText("Brought into scope"),
    ).toBeVisible();
  });

  it("user lines are shown verbatim and are editable", async () => {
    const user = userEvent.setup();
    mount(designed);
    const line = row("Members of a household share the same lists");
    expect(within(line).getByText("Yours")).toBeVisible();
    expect(within(line).queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();

    await user.click(within(line).getByRole("button", { name: "Edit" }));
    const input = screen.getByRole("textbox", { name: "Edit requirement" });
    expect(input).toHaveValue("Members of a household share the same lists");
    await user.clear(input);
    await user.type(input, "Households share lists{Enter}");
    expect(currentBrief()?.inputs.requirements).toEqual([
      { id: "r1", kind: "functional", text: "Households share lists" },
    ]);

    await user.click(within(row("Households share lists")).getByRole("button", { name: "Delete" }));
    expect(currentBrief()?.inputs.requirements).toEqual([]);

    await user.click(within(row("Paying for groceries")).getByRole("button", { name: "Edit" }));
    const scopeInput = screen.getByRole("textbox", { name: "Edit out-of-scope line" });
    await user.clear(scopeInput);
    await user.type(scopeInput, "Payments{Enter}");
    expect(currentBrief()?.inputs.outOfScope).toEqual([{ id: "o1", text: "Payments" }]);
  });

  it("adds a requirement line of the group's kind", async () => {
    const user = userEvent.setup();
    mount(designed);
    await user.click(screen.getByRole("button", { name: "Add a non-functional requirement" }));
    await user.type(screen.getByRole("textbox", { name: "New requirement" }), "Loads in 1 s");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(currentBrief()?.inputs.requirements).toContainEqual({
      id: NEW_ID,
      kind: "nonFunctional",
      text: "Loads in 1 s",
    });
  });

  it("does not save an empty line", async () => {
    const user = userEvent.setup();
    mount(designed);
    await user.click(
      within(row("Members of a household share the same lists")).getByRole("button", {
        name: "Edit",
      }),
    );
    await user.clear(screen.getByRole("textbox", { name: "Edit requirement" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
