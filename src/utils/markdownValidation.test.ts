import { describe, expect, it } from "vite-plus/test";
import { parseMarkdown } from "./import";

const components = `# Architecture Diagram

## Components

| Component | Type | Technology | Port | Description |
|-----------|------|------------|------|-------------|
| API | service | Node.js | 3000 | Public API |
| DB | database | PostgreSQL | 5432 | Storage |

`;

describe("Markdown import validation", () => {
  it("rejects unknown component types instead of substituting a service", () => {
    const result = parseMarkdown(components.replace("| service |", "| unsupported |"));
    expect(result.success).toBe(false);
    expect(result.errors?.join(" ")).toContain("unsupported");
  });

  it.each([
    "| API | DB | unsupported | - | Bad protocol |",
    "| API | DB | http | UNSUPPORTED | Bad method |",
    "| API | Missing | http | GET | Missing endpoint |",
  ])("rejects invalid connections instead of dropping them: %s", (row) => {
    const result = parseMarkdown(`${components}## Connections

| Source | Target | Protocol | Method | Description |
|--------|--------|----------|--------|-------------|
${row}

`);
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
  });
});
