import { describe, it, expect } from "vitest";
import { translateAnthropicToOpenAI, translateOpenAIResponseToAnthropic } from "../translation/anthropic-to-openai";

describe("Anthropic to OpenAI translation", () => {
  describe("translateAnthropicToOpenAI", () => {
    it("should convert basic messages", () => {
      const input = {
        model: "claude-sonnet-4-20250514",
        messages: [
          { role: "user" as const, content: "Hello" },
        ],
        max_tokens: 100,
      };

      const result = translateAnthropicToOpenAI(input, "drop");
      expect(result.model).toBe("claude-sonnet-4-20250514");
      expect(result.max_tokens).toBe(100);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[0].content).toBe("Hello");
    });

    it("should convert system param to system message", () => {
      const input = {
        model: "claude-sonnet-4-20250514",
        system: "You are helpful",
        messages: [
          { role: "user" as const, content: "Hi" },
        ],
        max_tokens: 100,
      };

      const result = translateAnthropicToOpenAI(input, "drop");
      expect(result.messages[0].role).toBe("system");
      expect(result.messages[0].content).toBe("You are helpful");
      expect(result.messages[1].role).toBe("user");
    });

    it("should convert tools", () => {
      const input = {
        model: "claude-sonnet-4-20250514",
        messages: [{ role: "user" as const, content: "Hi" }],
        tools: [
          { name: "get_weather", description: "Get weather", input_schema: { type: "object", properties: { city: { type: "string" } } } },
        ],
        max_tokens: 100,
      };

      const result = translateAnthropicToOpenAI(input, "drop");
      expect(result.tools).toHaveLength(1);
      expect(result.tools![0].type).toBe("function");
      expect(result.tools![0].function.name).toBe("get_weather");
      expect(result.tools![0].function.parameters).toEqual({ type: "object", properties: { city: { type: "string" } } });
    });

    it("should convert tool results", () => {
      const input = {
        model: "claude-sonnet-4-20250514",
        messages: [
          {
            role: "user" as const,
            content: [
              { type: "tool_result" as const, tool_use_id: "toolu_1", content: "result data" },
            ],
          },
        ],
        max_tokens: 100,
      };

      const result = translateAnthropicToOpenAI(input, "drop");
      expect(result.messages[0].role).toBe("tool");
      expect(result.messages[0].tool_call_id).toBe("toolu_1");
      expect(result.messages[0].content).toBe("result data");
    });

    it("should convert assistant tool_use blocks", () => {
      const input = {
        model: "claude-sonnet-4-20250514",
        messages: [
          {
            role: "assistant" as const,
            content: [
              { type: "text" as const, text: "Let me search" },
              { type: "tool_use" as const, id: "toolu_1", name: "search", input: { q: "test" } },
            ],
          },
        ],
        max_tokens: 100,
      };

      const result = translateAnthropicToOpenAI(input, "drop");
      expect(result.messages[0].role).toBe("assistant");
      expect(result.messages[0].content).toBe("Let me search");
      expect(result.messages[0].tool_calls).toHaveLength(1);
      expect(result.messages[0].tool_calls![0].function.name).toBe("search");
      expect(result.messages[0].tool_calls![0].function.arguments).toBe('{"q":"test"}');
    });

    it("should convert image content", () => {
      const input = {
        model: "claude-sonnet-4-20250514",
        messages: [
          {
            role: "user" as const,
            content: [
              { type: "text" as const, text: "What is this?" },
              { type: "image" as const, source: { type: "base64", media_type: "image/png", data: "abc123" } },
            ],
          },
        ],
        max_tokens: 100,
      };

      const result = translateAnthropicToOpenAI(input, "drop");
      const content = result.messages[0].content as any[];
      expect(content).toHaveLength(2);
      expect(content[0].type).toBe("text");
      expect(content[1].type).toBe("image_url");
      expect(content[1].image_url.url).toBe("data:image/png;base64,abc123");
    });
  });

  describe("translateOpenAIResponseToAnthropic", () => {
    it("should convert text response", () => {
      const openaiResponse = {
        id: "chatcmpl-123",
        choices: [{
          message: { role: "assistant", content: "Hello!" },
          finish_reason: "stop",
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      };

      const result = translateOpenAIResponseToAnthropic(openaiResponse, "claude-sonnet-4-20250514");
      expect(result.type).toBe("message");
      expect(result.role).toBe("assistant");
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toBe("Hello!");
      expect(result.stop_reason).toBe("end_turn");
      expect(result.usage.input_tokens).toBe(10);
    });

    it("should convert tool calls response", () => {
      const openaiResponse = {
        id: "chatcmpl-123",
        choices: [{
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{ id: "call_1", type: "function", function: { name: "search", arguments: '{"q":"test"}' } }],
          },
          finish_reason: "tool_calls",
        }],
        usage: { prompt_tokens: 20, completion_tokens: 15 },
      };

      const result = translateOpenAIResponseToAnthropic(openaiResponse, "claude-sonnet-4-20250514");
      expect(result.content[0].type).toBe("tool_use");
      expect(result.content[0].id).toBe("call_1");
      expect(result.content[0].name).toBe("search");
      expect(result.content[0].input).toEqual({ q: "test" });
      expect(result.stop_reason).toBe("tool_use");
    });

    it("should map finish reasons correctly", () => {
      const makeResponse = (finish: string) => ({ choices: [{ message: { content: "" }, finish_reason: finish }], usage: {} });
      expect(translateOpenAIResponseToAnthropic(makeResponse("stop"), "m").stop_reason).toBe("end_turn");
      expect(translateOpenAIResponseToAnthropic(makeResponse("length"), "m").stop_reason).toBe("max_tokens");
      expect(translateOpenAIResponseToAnthropic(makeResponse("tool_calls"), "m").stop_reason).toBe("tool_use");
    });
  });
});
