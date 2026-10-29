import { describe, expect, it } from "vite-plus/test";
import {
  aiSettingsSchema,
  analysisCacheSchema,
  onboardingStateSchema,
  persistedThemeStoreSchema,
  themeStateSchema,
} from "@/schemas/persistence";

const validAnalysis = {
  summary: "Healthy architecture",
  score: 90,
  issues: [
    {
      id: "issue-1",
      severity: "info",
      category: "reliability",
      title: "Looks good",
      description: "No action required",
      affectedNodes: [],
    },
  ],
  recommendations: [
    {
      id: "recommendation-1",
      title: "Keep monitoring",
      description: "Retain existing observability",
      priority: "low",
      effort: "low",
    },
  ],
  analyzedAt: "2026-01-01T00:00:00.000Z",
};

describe("persistence schemas", () => {
  it("accepts supported AI settings", () => {
    expect(
      aiSettingsSchema.parse({ provider: "openai", apiKey: null, model: "gpt-4-turbo" }),
    ).toEqual({ provider: "openai", apiKey: null, model: "gpt-4-turbo" });
  });

  it("rejects unknown AI providers and models", () => {
    expect(
      aiSettingsSchema.safeParse({ provider: "unknown", apiKey: "secret", model: "unknown" })
        .success,
    ).toBe(false);
  });

  it("hydrates cached analysis dates", () => {
    const result = analysisCacheSchema.parse({
      diagramHash: "hash",
      analysis: validAnalysis,
      expiresAt: Date.now() + 1_000,
    });

    expect(result.analysis.analyzedAt).toBeInstanceOf(Date);
    expect(result.analysis.issues[0]).not.toHaveProperty("suggestedFix");
  });

  it("retains an optional suggested fix", () => {
    const result = analysisCacheSchema.parse({
      diagramHash: "hash",
      analysis: {
        ...validAnalysis,
        issues: [{ ...validAnalysis.issues[0], suggestedFix: "Add a replica" }],
      },
      expiresAt: Date.now() + 1_000,
    });

    expect(result.analysis.issues[0]).toHaveProperty("suggestedFix", "Add a replica");
  });

  it("rejects malformed cached analysis", () => {
    expect(
      analysisCacheSchema.safeParse({ diagramHash: "hash", analysis: {}, expiresAt: "later" })
        .success,
    ).toBe(false);
  });

  it("accepts valid theme state and persisted wrappers", () => {
    expect(themeStateSchema.parse({ theme: "dark" }).theme).toBe("dark");
    expect(
      persistedThemeStoreSchema.parse({ state: { theme: "system" }, version: 0 }).state.theme,
    ).toBe("system");
  });

  it("rejects invalid persisted themes", () => {
    expect(themeStateSchema.safeParse({ theme: "sepia" }).success).toBe(false);
    expect(persistedThemeStoreSchema.safeParse({ state: null }).success).toBe(false);
  });

  it("requires a complete onboarding persistence record", () => {
    const validState = {
      completedSteps: {
        "add-node": true,
        "connect-nodes": false,
        "set-contract": false,
        "run-flow-sim": false,
      },
      dismissed: false,
      initialized: true,
    };

    expect(onboardingStateSchema.parse(validState)).toEqual(validState);
    expect(
      onboardingStateSchema.safeParse({ ...validState, completedSteps: { "add-node": true } })
        .success,
    ).toBe(false);
  });
});
