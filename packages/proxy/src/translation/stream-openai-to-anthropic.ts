import { logger } from "../logger.js";

export class StreamOpenAIToAnthropic {
  private messageId: string;
  private model: string;
  private blockIndex = -1;
  private started = false;

  constructor(model: string) {
    this.messageId = "msg_" + Math.random().toString(36).slice(2);
    this.model = model;
  }

  *translate(chunk: string): Generator<string> {
    const lines = chunk.split("\n");
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") {
        if (this.blockIndex >= 0) {
          yield `event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: this.blockIndex })}\n\n`;
        }
        yield `event: message_delta\ndata: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 0 } })}\n\n`;
        yield `event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`;
        return;
      }

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;
        const finishReason = parsed.choices?.[0]?.finish_reason;

        if (!this.started) {
          this.started = true;
          yield `event: message_start\ndata: ${JSON.stringify({ type: "message_start", message: { id: this.messageId, type: "message", role: "assistant", model: this.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } } })}\n\n`;
        }

        if (delta?.content) {
          if (this.blockIndex < 0) {
            this.blockIndex = 0;
            yield `event: content_block_start\ndata: ${JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } })}\n\n`;
          }
          yield `event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", index: this.blockIndex, delta: { type: "text_delta", text: delta.content } })}\n\n`;
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = (tc.index || 0) + 1;
            if (idx > this.blockIndex) {
              if (this.blockIndex >= 0) {
                yield `event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: this.blockIndex })}\n\n`;
              }
              this.blockIndex = idx;
              yield `event: content_block_start\ndata: ${JSON.stringify({ type: "content_block_start", index: idx, content_block: { type: "tool_use", id: tc.id || "", name: tc.function?.name || "", input: {} } })}\n\n`;
            }
            if (tc.function?.arguments) {
              yield `event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", index: idx, delta: { type: "input_json_delta", partial_json: tc.function.arguments } })}\n\n`;
            }
          }
        }

        if (finishReason) {
          if (this.blockIndex >= 0) {
            yield `event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: this.blockIndex })}\n\n`;
          }
          const stopReason = finishReason === "tool_calls" ? "tool_use" : finishReason === "length" ? "max_tokens" : "end_turn";
          yield `event: message_delta\ndata: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 0 } })}\n\n`;
          yield `event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`;
        }
      } catch (e) {
        logger.warn({ error: e, data }, "Failed to parse OpenAI stream chunk");
      }
    }
  }
}
