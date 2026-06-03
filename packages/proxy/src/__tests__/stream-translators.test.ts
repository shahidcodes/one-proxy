import { describe, it, expect } from "vitest";
import { StreamOpenAIToAnthropic } from "../translation/stream-openai-to-anthropic";
import { StreamAnthropicToOpenAI } from "../translation/stream-anthropic-to-openai";

describe("StreamOpenAIToAnthropic", () => {
  it("should emit message_start on first chunk", () => {
    const translator = new StreamOpenAIToAnthropic("gpt-4o");
    const chunk = 'data: {"id":"chatcmpl-1","choices":[{"delta":{"content":"Hi"},"finish_reason":null}]}\n\n';
    const results = [...translator.translate(chunk)];
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results[0]).toContain("message_start");
  });

  it("should emit content_block_delta for text", () => {
    const translator = new StreamOpenAIToAnthropic("gpt-4o");
    const chunk1 = 'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n\n';
    const results1 = [...translator.translate(chunk1)];
    expect(results1.some(r => r.includes("content_block_delta"))).toBe(true);
    expect(results1.some(r => r.includes("Hello"))).toBe(true);
  });

  it("should emit message_stop on [DONE]", () => {
    const translator = new StreamOpenAIToAnthropic("gpt-4o");
    const chunk1 = 'data: {"choices":[{"delta":{"content":"Hi"},"finish_reason":null}]}\n\n';
    [...translator.translate(chunk1)];
    const results = [...translator.translate("data: [DONE]\n\n")];
    expect(results.some(r => r.includes("message_stop"))).toBe(true);
  });
});

describe("StreamAnthropicToOpenAI", () => {
  it("should emit OpenAI chunk on message_start", () => {
    const translator = new StreamAnthropicToOpenAI("claude-sonnet-4-20250514");
    const chunk = 'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1"}}\n\n';
    const results = [...translator.translate(chunk)];
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]).toContain("chat.completion.chunk");
  });

  it("should emit text delta", () => {
    const translator = new StreamAnthropicToOpenAI("claude-sonnet-4-20250514");
    const chunk = 'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\n';
    const results = [...translator.translate(chunk)];
    expect(results.some(r => r.includes("Hello"))).toBe(true);
  });

  it("should emit [DONE] on message_stop", () => {
    const translator = new StreamAnthropicToOpenAI("claude-sonnet-4-20250514");
    const chunk = 'event: message_stop\ndata: {"type":"message_stop"}\n\n';
    const results = [...translator.translate(chunk)];
    expect(results.some(r => r.includes("[DONE]"))).toBe(true);
  });
});
