import AnthropicSDK from "@anthropic-ai/sdk";
import { Message, ProviderConfig } from "../types.js";
import { Provider } from "./interface.js";

export class AnthropicProvider implements Provider {
  readonly name = "anthropic";
  private client: AnthropicSDK;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.client = new AnthropicSDK({ apiKey: config.apiKey });
  }

  async *sendMessage(messages: Message[], systemPrompt?: string): AsyncIterable<string> {
    const attempts = (this.config.retryCount ?? 1) + 1;
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const stream = await this.client.messages.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens ?? 4096,
          system: systemPrompt || "You are a helpful AI assistant.",
          messages: messages
            .filter((m): m is Message & { role: "user" | "assistant" } => m.role !== "system")
            .map((m) => ({ role: m.role, content: m.content })),
          stream: true,
        });

        for await (const chunk of stream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            yield chunk.delta.text;
          }
        }
        return;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError instanceof Error) {
      throw new Error(`Anthropic request failed: ${lastError.message}`);
    }
    throw new Error("Anthropic request failed.");
  }
}
