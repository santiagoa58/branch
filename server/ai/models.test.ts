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
    expect(aiEnvSchema.safeParse({ AI_MODEL: "" }).success).toBe(false);
  });
  it("treats empty optional settings as unset", () => {
    const env = aiEnvSchema.parse({
      AI_MODEL: "provider/default",
      AI_GATEWAY_API_KEY: "",
      AI_MODEL_REQUIREMENTS: "",
      AI_MODEL_COMPONENTS: "",
      AI_MODEL_DECISIONS: "",
      AI_MODEL_API: "",
      AI_MODEL_DATA_MODEL: "",
    });
    expect(env.AI_GATEWAY_API_KEY).toBeUndefined();
    expect(modelFor("requirements", env)).toBe("provider/default");
    expect(modelFor("components", env)).toBe("provider/default");
    expect(modelFor("decisions", env)).toBe("provider/default");
    expect(modelFor("api", env)).toBe("provider/default");
    expect(modelFor("data-model", env)).toBe("provider/default");
  });
});
