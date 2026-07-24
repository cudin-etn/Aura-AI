export type AuraCapabilityStatus = "available" | "partial" | "planned";

export type AuraCapability = {
  id: string;
  label: string;
  status: AuraCapabilityStatus;
  endpoint?: string;
  note: string;
};

export const AURA_CAPABILITIES: AuraCapability[] = [
  { id: "model-discovery", label: "Model discovery", status: "available", endpoint: "/v1/models", note: "Discover normalized models from configured providers." },
  { id: "fallback-combos", label: "Provider fallback combos", status: "available", endpoint: "/api/combos", note: "Route through ordered targets with cooldown and failover controls." },
  { id: "chat", label: "Chat & code generation", status: "available", endpoint: "/v1/chat/completions", note: "OpenAI Chat Completions, Responses, and Anthropic Messages are available." },
  { id: "image", label: "Image generation", status: "available", endpoint: "/v1/images/generations", note: "Relayed through a configured OpenAI-compatible image provider." },
  { id: "vision", label: "Vision input", status: "partial", endpoint: "/v1/chat/completions", note: "Use image content with a model that declares vision support." },
  { id: "web-search", label: "Web search", status: "available", endpoint: "/v1/alpha/search", note: "Available when a ChatGPT forward account is configured." },
  { id: "web-fetch", label: "Web fetch", status: "planned", note: "Not exposed as a standalone public endpoint yet." },
  { id: "tts", label: "Text to speech", status: "planned", note: "Provider adapter and audio response contract are not implemented yet." },
  { id: "stt", label: "Speech to text", status: "planned", note: "Provider adapter and multipart audio contract are not implemented yet." },
  { id: "embeddings", label: "Embeddings", status: "planned", note: "Embedding model discovery and vector response contract are not implemented yet." },
];
