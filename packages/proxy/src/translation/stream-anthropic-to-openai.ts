import { logger } from "../logger.js";

export class StreamAnthropicToOpenAI {
  private id: string;
  private model: string;

  constructor(model: string) {
    this.id = "chatcmpl-" + Math.random().toString(36).slice(2);
    this.model = model;
  }

  *translate(chunk: string): Generator<string> {
    const lines = chunk.split("\n");
    let eventType = "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim();
        continue;
      }
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();

      try {
        const parsed = JSON.parse(data);

        switch (parsed.type || eventType) {
          case "message_start":
            yield `data: ${JSON.stringify({ id: this.id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: this.model, choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }] })}\n\n`;
            break;

          case "content_block_start":
            if (parsed.content_block?.type === "tool_use") {
              yield `data: ${JSON.stringify({ id: this.id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: this.model, choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: parsed.content_block.id, type: "function", function: { name: parsed.content_block.name, arguments: "" } }] }, finish_reason: null }] })}\n\n`;
            }
            break;

          case "content_block_delta":
            if (parsed.delta?.type === "text_delta") {
              yield `data: ${JSON.stringify({ id: this.id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: this.model, choices: [{ index: 0, delta: { content: parsed.delta.text }, finish_reason: null }] })}\n\n`;
            } else if (parsed.delta?.type === "input_json_delta") {
              yield `data: ${JSON.stringify({ id: this.id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: this.model, choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: parsed.delta.partial_json } }] }, finish_reason: null }] })}\n\n`;
            }
            break;

          case "message_delta":
            if (parsed.delta?.stop_reason) {
              const finishReason = parsed.delta.stop_reason === "tool_use" ? "tool_calls" : parsed.delta.stop_reason === "max_tokens" ? "length" : "stop";
              yield `data: ${JSON.stringify({ id: this.id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: this.model, choices: [{ index: 0, delta: {}, finish_reason: finishReason }] })}\n\n`;
            }
            break;

          case "message_stop":
            yield `data: [DONE]\n\n`;
            break;
        }
      } catch (e) {
        logger.warn({ error: e, data }, "Failed to parse Anthropic stream chunk");
      }
    }
  }
}
