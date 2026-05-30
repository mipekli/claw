export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ProviderConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  baseUrl?: string;
  timeoutMs?: number;
  retryCount?: number;
}

export interface Config {
  provider: "anthropic" | "openai" | "openrouter";
  anthropic?: ProviderConfig;
  openai?: ProviderConfig;
  openrouter?: ProviderConfig;
  systemPrompt?: string;
  debug?: boolean;
  telegram?: {
    token: string;
    allowedUserIds?: number[];
    adminUserIds?: number[];
    historyEnabled?: boolean;
  };
}

export interface Provider {
  name: string;
  sendMessage(messages: Message[], systemPrompt?: string): AsyncIterable<string>;
}
