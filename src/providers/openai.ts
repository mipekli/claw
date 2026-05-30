import OpenAI from "openai";
import { Message, ProviderConfig } from "../types.js";
import { Provider } from "./interface.js";

export class OpenAIProvider implements Provider {
  readonly name = "openai";
  private client: OpenAI;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    const opts: Record<string, any> = { apiKey: config.apiKey };
    if (config.baseUrl) {
      opts.baseURL = config.baseUrl;
    }
    this.client = new OpenAI(opts);
  }

  async *sendMessage(messages: Message[], systemPrompt?: string): AsyncIterable<string> {
    const systemMsg = systemPrompt
      ? [{ role: "system" as const, content: systemPrompt }]
      : [];

    const stream = await this.client.chat.completions.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens ?? 4096,
      messages: [...systemMsg, ...messages.map((m) => ({ role: m.role, content: m.content }))],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }
}
