/**
 * Translate legacy product wording at the presentation boundary.
 *
 * Runtime identifiers such as ~/.opencodex and x-opencodex-api-key remain
 * unchanged because they are migration/API contracts, not visible branding.
 */
export function auraBrandCopy(value: string): string {
  const protectedTokens: string[] = [];
  const protect = (token: string): string => {
    const marker = `\u0000${protectedTokens.length}\u0000`;
    protectedTokens.push(token);
    return marker;
  };
  let copy = value
    .replaceAll("~/.opencodex", protect("~/.opencodex"))
    .replaceAll("x-opencodex-api-key", protect("x-opencodex-api-key"))
    .replaceAll("X-OpenCodex-API-Key", protect("X-OpenCodex-API-Key"));
  copy = copy
    .replace(/\bOpenCodex\b/g, "Aura AI")
    .replace(/\bopencodex\b/g, "Aura AI")
    .replace(/\bocx(?=\s)/g, "aura");
  return copy.replace(/\u0000(\d+)\u0000/g, (_, index: string) => protectedTokens[Number(index)] ?? "");
}
