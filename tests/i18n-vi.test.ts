import { describe, expect, test } from "bun:test";
import { en } from "../gui/src/i18n/en";
import { vi } from "../gui/src/i18n/vi";

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{[^{}]+\}/g)].map(match => match[0]).sort();
}

describe("Vietnamese locale", () => {
  test("covers every English key without extras", () => {
    expect(Object.keys(vi).sort()).toEqual(Object.keys(en).sort());
  });

  test("preserves interpolation placeholders", () => {
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(placeholders(vi[key]), key).toEqual(placeholders(en[key]));
    }
  });

  test("does not silently fall back to the English dictionary", async () => {
    const source = await Bun.file(new URL("../gui/src/i18n/vi.ts", import.meta.url)).text();
    expect(source).not.toContain('import { en');
    expect(source).not.toMatch(/\.\.\.\s*en\b/);
  });
});
