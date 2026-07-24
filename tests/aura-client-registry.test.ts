import { describe, expect, test } from "bun:test";
import {
  AURA_CLIENT_ADAPTERS,
  auraClientLogFields,
  auraClientSurface,
} from "../src/clients/registry";

describe("Aura client registry", () => {
  test("maps public protocol endpoints to explicit client adapters", () => {
    expect(auraClientSurface("/v1/responses")).toEqual({ client: "codex", protocol: "responses" });
    expect(auraClientSurface("/v1/responses/compact")).toEqual({ client: "codex", protocol: "responses" });
    expect(auraClientSurface("/v1/messages")).toEqual({ client: "claude-code", protocol: "messages" });
    expect(auraClientSurface("/v1/chat/completions")).toEqual({
      client: "opencode",
      protocol: "chat-completions",
    });
    expect(auraClientSurface("/v1/unknown")).toBeNull();
  });

  test("keeps unsupported clients explicit instead of claiming production support", () => {
    expect(AURA_CLIENT_ADAPTERS.find(client => client.id === "zcode")).toMatchObject({
      maturity: "experimental",
      configurable: false,
      protocols: ["chat-completions"],
    });
    expect(auraClientLogFields("/v1/messages")).toEqual({
      auraClient: "claude-code",
      auraProtocol: "messages",
    });
    expect(AURA_CLIENT_ADAPTERS.find(client => client.id === "factory")).toMatchObject({
      maturity: "basic",
      configurable: true,
      protocols: ["responses"],
    });
    expect(AURA_CLIENT_ADAPTERS.find(client => client.id === "generic")).toMatchObject({
      maturity: "basic",
      configurable: false,
    });
  });
});
