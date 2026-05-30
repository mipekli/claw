import { Message } from "../types.js";

export interface Provider {
  readonly name: string;
  sendMessage(messages: Message[], systemPrompt?: string): AsyncIterable<string>;
}
