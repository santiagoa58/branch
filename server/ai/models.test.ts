// @vitest-environment node
import { describe, it, expect } from "vite-plus/test";
import { aiEnvSchema } from "../../src/schemas/server";
import { modelFor } from "./models";

describe("modelFor", () => {
  it("uses the default model without an override", () => {
    const env = aiEnvSchema.parse({ AI_MODEL: "provider/default" });
    expect(modelFor("requirements", env)).toBe("provider/default");
  });
  it("prefers the stage override", () => {
    const env = aiEnvSchema.parse({
      AI_MODEL: "provider/default",
      AI_MODEL_DATA_MODEL: "provider/data",
    });
    expect(modelFor("data-model", env)).toBe("provider/data");
    expect(modelFor("api", env)).toBe("provider/default");
  });
  it("requires a default model", () => {
    expect(aiEnvSchema.safeParse({}).success).toBe(false);
  });
});
