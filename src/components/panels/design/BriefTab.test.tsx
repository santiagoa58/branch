import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vite-plus/test";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DesignBrief } from "@/schemas/aiDesign";
import { cloudWorkspace } from "@/services/cloudWorkspace";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useDiagramStore } from "@/store/diagramStore";
import {
  answerQuestion,
  assumeRemaining,
  bringIntoScope,
  changeAssumption,
  confirmAssumption,
  createBrief,
  removeDerivedRequirement,
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

describe("composer", () => {
  it("Start design creates the brief from the composer and runs the update", async () => {
    const user = userEvent.setup();
    mount(null);
    const start = screen.getByRole("button", { name: "Start design" });
    expect(start).toBeDisabled();

    await user.type(
      screen.getByRole("textbox", { name: "What should we design?" }),
      "A shared grocery list",
    );
    await user.click(screen.getByRole("button", { name: /^Backend/ }));
    expect(screen.getByRole("button", { name: /^Backend/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: /Add requirements/ }));
    await user.click(screen.getByRole("button", { name: "Add line for functional requirements" }));
    await user.type(
      screen.getByRole("textbox", { name: "Functional requirement 1" }),
      "Members share lists",
    );
    await user.click(screen.getByRole("button", { name: "Add line for constraints" }));
    await user.type(screen.getByRole("textbox", { name: "Constraint 1" }), "Runs on AWS");
    await user.click(screen.getByRole("button", { name: "Add line for out of scope" }));
    await user.type(screen.getByRole("textbox", { name: "Out of scope 1" }), "Payments");
    // Blank lines are ignored.
    await user.click(
      screen.getByRole("button", { name: "Add line for non-functional requirements" }),
    );

    await user.click(start);

    expect(currentBrief()).toEqual(
      createBrief(
        "A shared grocery list",
        "backend",
        [
          { kind: "functional", text: "Members share lists" },
          { kind: "constraint", text: "Runs on AWS" },
        ],
        ["Payments"],
        newId,
      ),
    );
    expect(pipeline.update).toHaveBeenCalledTimes(1);
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

describe("questions", () => {
  it("Continue is disabled until every question has an answer", async () => {
    const user = userEvent.setup();
    mount(asking);
    const next = screen.getByRole("button", { name: "Continue" });
    expect(next).toBeDisabled();

    const recommended = screen.getByRole("button", { name: /About 1M households/ });
    expect(within(recommended).getByText("Recommended")).toBeVisible();
    expect(within(recommended).getByText("Read replicas and a cache for hot lists")).toBeVisible();
    await user.click(recommended);
    expect(recommended).toHaveAttribute("aria-pressed", "true");
    expect(next).toBeDisabled();

    // A question without options takes a written answer.
    await user.type(
      screen.getByRole("textbox", { name: "What should happen without a signal in the store?" }),
      "Read only offline",
    );
    expect(next).toBeEnabled();
    await user.click(next);

    let expected = answerQuestion(
      asking,
      asking.questions[0]!.question,
      "About 1M households",
      newId,
    );
    expected = answerQuestion(expected, asking.questions[1]!.question, "Read only offline", newId);
    expect(currentBrief()).toEqual(expected);
    expect(pipeline.update).toHaveBeenCalledTimes(1);
  });

  it("Assume the rest for me records assumed answers and runs the update", async () => {
    const user = userEvent.setup();
    mount(asking);
    await user.click(screen.getByRole("button", { name: /Up to 10k households/ }));
    await user.click(screen.getByRole("button", { name: "Assume the rest for me" }));

    const expected = assumeRemaining(
      answerQuestion(asking, asking.questions[0]!.question, "Up to 10k households", newId),
      newId,
    );
    expect(currentBrief()).toEqual(expected);
    expect(currentBrief()?.inputs.answers).toEqual([
      expect.objectContaining({ answer: "Up to 10k households", assumed: false }),
      expect.objectContaining({ answer: "The list keeps working offline", assumed: true }),
    ]);
    expect(pipeline.update).toHaveBeenCalledTimes(1);
  });

  it("offers a written answer where the question allows one", async () => {
    const user = userEvent.setup();
    mount({
      ...asking,
      questions: [{ ...asking.questions[0]!, allowsCustom: true }],
    });
    await user.click(screen.getByRole("button", { name: "Write my own answer" }));
    await user.type(
      screen.getByRole("textbox", { name: "Roughly how many households should this serve?" }),
      "About 50k",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(currentBrief()?.inputs.answers).toEqual([
      expect.objectContaining({ answer: "About 50k", assumed: false }),
    ]);
  });
});

describe("brief sections", () => {
  async function act(label: string) {
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
      const expected = await act(label);
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
