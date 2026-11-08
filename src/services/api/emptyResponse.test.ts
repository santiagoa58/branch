import { describe, expect, it } from "vite-plus/test";
import { ZodError } from "zod";
import { readEmptyResponse } from "./emptyResponse";
import { ApiResponseValidationError } from "./errors";

const contractMessage =
  "Invalid response from DELETE /diagrams/diagram-a: the backend response does not match the API contract.";

describe("readEmptyResponse", () => {
  it("resolves for 204 No Content without a body", async () => {
    const response = new Response(null, { status: 204 });

    await expect(
      readEmptyResponse("DELETE", "/diagrams/diagram-a", response),
    ).resolves.toBeUndefined();
    expect(response.bodyUsed).toBe(false);
  });

  it.each([
    { status: 200, body: null },
    { status: 200, body: "{}" },
    { status: 201, body: "" },
    { status: 202, body: null },
  ])(
    "rejects status $status with body $body as ApiResponseValidationError without reading it",
    async ({ status, body }) => {
      const response = new Response(body, { status });

      const error = await readEmptyResponse("DELETE", "/diagrams/diagram-a", response).catch(
        (caught: unknown) => caught,
      );

      expect(error).toBeInstanceOf(ApiResponseValidationError);
      expect(error).toMatchObject({ name: "ApiResponseValidationError", message: contractMessage });
      expect(error).toHaveProperty("cause", new Error("Expected HTTP 204 No Content."));
      expect(response.bodyUsed).toBe(false);
    },
  );

  it("rejects a 204 response that nevertheless carries a body", async () => {
    // The Fetch API refuses to build a 204 with a body, so shadow the status of a 200 instead.
    const response = new Response("unexpected");
    Object.defineProperty(response, "status", { value: 204 });

    const error = await readEmptyResponse("DELETE", "/diagrams/diagram-a", response).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiResponseValidationError);
    expect(error).toMatchObject({ message: contractMessage });
    expect(error).toHaveProperty("cause", expect.any(ZodError));
  });

  it("names the method and path in the error message", async () => {
    await expect(
      readEmptyResponse("POST", "/projects/p/archive", new Response("[]")),
    ).rejects.toThrow(
      "Invalid response from POST /projects/p/archive: the backend response does not match the API contract.",
    );
  });
});
