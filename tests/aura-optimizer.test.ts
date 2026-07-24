import { describe, expect, test } from "bun:test";
import { isProtectedAuraToolOutput, optimizeAuraToolOutputs } from "../src/optimizer/tool-output";
import type { OcxMessage, OcxToolResultMessage } from "../src/types";

function result(callId: string, content: string, toolName = "exec_command"): OcxToolResultMessage {
  return {
    role: "toolResult",
    toolCallId: callId,
    toolName,
    content,
    isError: false,
    timestamp: 0,
  };
}

describe("Aura tool-output optimizer", () => {
  test("deduplicates only a later exact non-protected output", () => {
    const repeated = "ordinary generated output ".repeat(40);
    const messages: OcxMessage[] = [result("a", repeated), result("b", repeated)];
    const metrics = optimizeAuraToolOutputs(messages, {
      deduplicate: true,
      reduceLogs: false,
    });
    expect(messages[0]).toMatchObject({ content: repeated });
    expect(String((messages[1] as OcxToolResultMessage).content)).toContain("original call=a");
    expect(metrics.deduplicated).toBe(1);
    expect(metrics.savedTokens).toBeGreaterThan(0);
  });

  test("preserves source, migrations, security evidence, and stack traces byte-for-byte", () => {
    const protectedMessages = [
      result("source", "```ts\nexport function x() { return 1; }\n```"),
      result("migration", "ALTER TABLE users ADD COLUMN active boolean;"),
      result("security", "OAuth credential redaction security test"),
      result("stack", "Error: boom\n    at run (/tmp/a.ts:1:2)"),
      result("patch", "ordinary text", "apply_patch"),
    ];
    for (const message of protectedMessages) expect(isProtectedAuraToolOutput(message)).toBe(true);
    const before = protectedMessages.map(message => message.content);
    const metrics = optimizeAuraToolOutputs(protectedMessages, {
      deduplicate: true,
      reduceLogs: true,
      logThresholdChars: 10,
      storeOutput: () => "must-not-store",
    });
    expect(protectedMessages.map(message => message.content)).toEqual(before);
    expect(metrics.protectedOutputs).toBe(protectedMessages.length);
    expect(metrics.savedTokens).toBe(0);
  });

  test("reduces bounded logs and returns a local retrieval handle", () => {
    const log = Array.from({ length: 120 }, (_, index) =>
      `[${index + 1}/120] INFO completed worker step ${index} ${".".repeat(120)}`).join("\n");
    const messages: OcxMessage[] = [result("log", log)];
    const metrics = optimizeAuraToolOutputs(messages, {
      deduplicate: false,
      reduceLogs: true,
      logThresholdChars: 1_000,
      logHeadChars: 300,
      logTailChars: 300,
      storeOutput: content => {
        expect(content).toBe(log);
        return "fixture-handle";
      },
    });
    const reduced = String((messages[0] as OcxToolResultMessage).content);
    expect(reduced).toStartWith(log.slice(0, 300));
    expect(reduced).toContain("full local output handle=fixture-handle");
    expect(reduced).toEndWith(log.slice(-300));
    expect(metrics.reducedLogs).toBe(1);
    expect(metrics.savedTokens).toBeGreaterThan(0);
  });

  test("enforces a role context budget only on reducible outputs", () => {
    const ordinary = "ordinary unchanged generated data ".repeat(500);
    const protectedSource = "```ts\nexport function protectedSource() {\n"
      + "  return true;\n".repeat(500)
      + "}\n```";
    const messages: OcxMessage[] = [
      result("ordinary", ordinary),
      result("source", protectedSource),
    ];
    const metrics = optimizeAuraToolOutputs(messages, {
      deduplicate: false,
      reduceLogs: false,
      contextBudgetTokens: 1_000,
      storeOutput: () => "budget-handle",
    });
    expect(String((messages[0] as OcxToolResultMessage).content)).toContain("Aura context budget elided");
    expect((messages[1] as OcxToolResultMessage).content).toBe(protectedSource);
    expect(metrics.budgetedOutputs).toBe(1);
    expect(metrics.protectedOutputs).toBe(1);
  });
});
