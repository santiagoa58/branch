import { describe, expect, it } from "vite-plus/test";
import { canvasCrossings } from "@/test/canvasRoutes";
import { DIAGRAM_TEMPLATES, layoutTemplate } from "@/templates";
import { autoLayoutDiagram } from "./layout";
import { countCrossings } from "./layout/crossings";
import { collaborativeDocsDesign } from "./layout/layoutFixtures";

/**
 * Crossings measured on the dagre layout this replaced (commit b84b0a5), before dagre was
 * removed, with the same fixtures:
 * - the 14-component collaborative editor from the user's report: 16 crossings as the canvas
 *   drew it then (Bezier curves between the bottom and top ports every edge fell back to), and
 *   4 even when routed like today (side ports, orthogonal lanes);
 * - all 30 starter templates together: 280 as drawn then.
 */
const DAGRE_COLLABORATIVE_DOCS = { asDrawn: 16, routedLikeToday: 4 };
const DAGRE_TEMPLATES_AS_DRAWN = 280;

describe("countCrossings", () => {
  it("counts proper crossings of orthogonal and straight routes only", () => {
    const horizontal = [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
    ];
    const vertical = [
      { x: 50, y: 0 },
      { x: 50, y: 100 },
    ];
    const diagonal = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ];
    const touching = [
      { x: 100, y: 50 },
      { x: 200, y: 50 },
    ];
    const step = [
      { x: 0, y: 80 },
      { x: 60, y: 80 },
      { x: 60, y: 20 },
      { x: 120, y: 20 },
    ];
    expect(countCrossings([horizontal, vertical])).toBe(1);
    expect(countCrossings([horizontal, vertical, diagonal])).toBe(3);
    expect(countCrossings([horizontal, touching])).toBe(0);
    expect(countCrossings([horizontal, horizontal])).toBe(0);
    expect(countCrossings([step, horizontal, vertical])).toBe(3);
    expect(countCrossings([])).toBe(0);
  });
});

describe("crossing regression", () => {
  it("crosses less than the dagre layout on the collaborative editor design", async () => {
    const { nodes, edges } = collaborativeDocsDesign();
    const result = await autoLayoutDiagram(nodes, edges);
    const crossings = canvasCrossings(result.nodes, result.edges);
    expect(crossings).toBeLessThanOrEqual(3);
    expect(crossings).toBeLessThan(DAGRE_COLLABORATIVE_DOCS.routedLikeToday);
    expect(crossings).toBeLessThan(DAGRE_COLLABORATIVE_DOCS.asDrawn);
  });

  it("keeps the starter templates' crossings low", async () => {
    let total = 0;
    for (const template of DIAGRAM_TEMPLATES) {
      const { data } = await layoutTemplate(template);
      total += canvasCrossings(data.nodes, data.edges);
    }
    expect(total).toBeLessThanOrEqual(70);
    expect(total).toBeLessThan(DAGRE_TEMPLATES_AS_DRAWN / 3);
  });
});
