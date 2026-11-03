import { describe, expect, it } from "vite-plus/test";
import {
  onboardingStateSchema,
  persistedThemeStoreSchema,
  themeStateSchema,
} from "@/schemas/persistence";

describe("persistence schemas", () => {
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
