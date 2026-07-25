import { describe, expect, test } from "bun:test";

describe("Aura information architecture", () => {
  test("keeps capability and optimizer controls on their canonical pages", async () => {
    const [app, overview, capabilities, optimization] = await Promise.all([
      Bun.file("gui/src/App.tsx").text(),
      Bun.file("gui/src/pages/AuraSetup.tsx").text(),
      Bun.file("gui/src/pages/Capabilities.tsx").text(),
      Bun.file("gui/src/pages/Optimization.tsx").text(),
    ]);
    expect(app).toContain('id: "capabilities"');
    expect(app).toContain('id: "optimization"');
    expect(overview).toContain('href="#capabilities"');
    expect(overview).toContain('href="#optimization"');
    expect(overview).not.toContain("const updateOptimizer");
    expect(capabilities).toContain("/api/aura/capabilities");
    expect(optimization).toContain("/api/aura/optimizer");
  });
});
