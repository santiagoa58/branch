import type { ConsideredOption, DesignDecision } from "@/types";

export interface DesignDecisionView {
  choice: string;
  reason: string;
  benefits: string[];
  drawbacks: string[];
  considered: ConsideredOption[];
  revisitWhen: string[];
}

/** An editable copy of a decision with every field present. Blank items are kept for draft rows. */
export function getDesignDecision(decision: DesignDecision | undefined): DesignDecisionView {
  return {
    choice: decision?.choice ?? "",
    reason: decision?.reason ?? "",
    benefits: [...(decision?.benefits ?? [])],
    drawbacks: [...(decision?.drawbacks ?? [])],
    considered: (decision?.considered ?? []).map((item) => ({ ...item })),
    revisitWhen: [...(decision?.revisitWhen ?? [])],
  };
}

/** Empty fields are omitted, but blank list rows are kept while they are being edited. */
export function toDesignDecision(view: DesignDecisionView): DesignDecision {
  const considered = view.considered.map((item) =>
    item.whyNot === undefined ? { option: item.option } : { ...item },
  );
  return {
    ...(view.choice ? { choice: view.choice } : {}),
    ...(view.reason ? { reason: view.reason } : {}),
    ...(view.benefits.length > 0 ? { benefits: [...view.benefits] } : {}),
    ...(view.drawbacks.length > 0 ? { drawbacks: [...view.drawbacks] } : {}),
    ...(considered.length > 0 ? { considered } : {}),
    ...(view.revisitWhen.length > 0 ? { revisitWhen: [...view.revisitWhen] } : {}),
  };
}

/** Identity for a considered option, also used as its display key. */
export function consideredKey(item: ConsideredOption): string {
  return `${item.option}\u0000${item.whyNot ?? ""}`;
}

function nonBlank(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

/**
 * The same decision with blank text, empty items and repeated entries removed, for display and
 * export. A repeated entry adds nothing, and unique entries can key their own list rows.
 */
export function getDocumentedDecision(decision: DesignDecision | undefined): DesignDecisionView {
  const view = getDesignDecision(decision);
  const considered = new Map<string, ConsideredOption>();
  for (const item of view.considered) {
    const option = item.option.trim();
    const whyNot = item.whyNot?.trim();
    if (option || whyNot) {
      const documented = whyNot ? { option, whyNot } : { option };
      considered.set(consideredKey(documented), documented);
    }
  }
  return {
    choice: view.choice.trim(),
    reason: view.reason.trim(),
    benefits: nonBlank(view.benefits),
    drawbacks: nonBlank(view.drawbacks),
    considered: [...considered.values()],
    revisitWhen: nonBlank(view.revisitWhen),
  };
}

export function hasDesignDecision(decision: DesignDecision | undefined): boolean {
  const view = getDocumentedDecision(decision);
  return (
    Boolean(view.choice) ||
    Boolean(view.reason) ||
    view.benefits.length > 0 ||
    view.drawbacks.length > 0 ||
    view.considered.length > 0 ||
    view.revisitWhen.length > 0
  );
}

const CONSIDERED_SEPARATOR = " — ";

/** One labeled row per item, shared by Markdown export/import and AI prompts. */
export function getDecisionRows(decision: DesignDecision | undefined): [string, string][] {
  const view = getDocumentedDecision(decision);
  return [
    ...(view.choice ? [["Choice", view.choice] as [string, string]] : []),
    ...(view.reason ? [["Why", view.reason] as [string, string]] : []),
    ...view.benefits.map((item): [string, string] => ["Benefit", item]),
    ...view.drawbacks.map((item): [string, string] => ["Drawback", item]),
    ...view.considered.map((item): [string, string] => [
      "Considered",
      item.whyNot ? `${item.option}${CONSIDERED_SEPARATOR}${item.whyNot}` : item.option,
    ]),
    ...view.revisitWhen.map((item): [string, string] => ["Revisit when", item]),
  ];
}

/** Inverse of getDecisionRows; rows with other labels are ignored. */
export function parseDecisionRows(rows: [string, string][]): DesignDecision {
  const view: DesignDecisionView = {
    choice: "",
    reason: "",
    benefits: [],
    drawbacks: [],
    considered: [],
    revisitWhen: [],
  };
  for (const [rawLabel, value] of rows) {
    switch (rawLabel.trim().toLowerCase()) {
      case "choice":
        view.choice = value;
        break;
      case "why":
        view.reason = value;
        break;
      case "benefit":
        view.benefits.push(value);
        break;
      case "drawback":
        view.drawbacks.push(value);
        break;
      case "considered": {
        const separator = value.indexOf(CONSIDERED_SEPARATOR);
        view.considered.push(
          separator === -1
            ? { option: value }
            : {
                option: value.slice(0, separator),
                whyNot: value.slice(separator + CONSIDERED_SEPARATOR.length),
              },
        );
        break;
      }
      case "revisit when":
        view.revisitWhen.push(value);
        break;
    }
  }
  return toDesignDecision(view);
}
