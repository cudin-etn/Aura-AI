export const packageName = "@tungninh/aura-ai";
export const cliCommand = "aura";

export async function loadBunApi() {
  if (typeof Bun === "undefined") {
    throw new Error("The Aura AI programmatic API requires the Bun runtime. Use `aura` for the CLI entrypoint.");
  }
  return import("../src/index.ts");
}
