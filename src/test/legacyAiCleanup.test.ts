import { describe, expect, it, vi } from "vite-plus/test";
import { removeLegacyAiSettings } from "@/lib/legacyAiCleanup";

describe("removeLegacyAiSettings", () => {
  it("removes the stale ai-settings key", () => {
    const storage = { removeItem: vi.fn<(key: string) => void>() };
    removeLegacyAiSettings(storage);
    expect(storage.removeItem).toHaveBeenCalledWith("ai-settings");
  });
  it("ignores storage that throws", () => {
    const storage = {
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => removeLegacyAiSettings(storage)).not.toThrow();
  });
});
