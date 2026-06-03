import { describe, it, expect } from "vitest";
import { translateOpenAIToAnthropic, translateAnthropicResponseToOpenAI } from "../translation/openai-to-anthropic";

describe("OpenAI to Anthropic translation", () => {
  describe("translateOpenAIToAnthropic", () => {
    it("should convert basic messages", () => {
      const input = {
        model: "gpt-4o",
        messages: [
          { role: "user" as const, content: "Hello" },
        ],
        max_tokens: 100,
      };

      const result = translateOpenAIToAnthropic(input, "drop");
      expect(result.model).toBe("gpt-4o");
      expect(result.max_tokens).toBe(100);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[0].content).toBe("Hello");
    });

    it("should extract system messages into system param", () => {
      const input = {
        model: "gpt-4o",
        messages: [
          { role: "system" as const, content: "You are helpful" },
          { role: "user" as const, content: "Hi" },
        ],
        max_tokens: 100,
      };

      const result = translateOpenAIToAnthropic(input, "drop");
      expect(result.system).toBe("You are helpful");
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
    });

    it("should concatenate multiple system messages", () => {
      const input = {
        model: "gpt-4o",
        messages: [
          { role: "system" as const, content: "First" },
          { role: "system" as const, content: "Second" },
          { role: "user" as const, content: "Hi" },
        ],
        max_tokens: 100,
      };

      const result = translateOpenAIToAnthropic(input, "drop");
      expect(result.system).toBe("First\n\nSecond");
    });

    it("should convert tools", () => {
      const input = {
        model: "gpt-4o",
        messages: [{ role: "user" as const, content: "Hi" }],
        tools: [
          {
            type: "function" as const,
            function: {
              name: "get_weather",
              description: "Get weather",
              parameters: { type: "object", properties: { city: { type: "string" } } },
            },
          },
        ],
        max_tokens: 100,
      };

      const result = translateOpenAIToAnthropic(input, "drop");
      expect(result.tools).toHaveLength(1);
      expect(result.tools![0].name).toBe("get_weather");
      expect(result.tools![0].input_schema).toEqual({ type: "object", properties: { city: { type: "string" } } });
    });

    it("should convert tool calls from assistant", () => {
      const input = {
        model: "gpt-4o",
        messages: [
          {
            role: "assistant" as const,
            content: "",
            tool_calls: [
              { id: "call_1", type: "function" as const, function: { name: "search", arguments: '{"q":"test"}' } },
            ],
          },
        ],
        max_tokens: 100,
      };

      const result = translateOpenAIToAnthropic(input, "drop");
      expect(result.messages[0].role).toBe("assistant");
      const content = result.messages[0].content as any[];
      expect(content).toHaveLength(1);
      expect(content[0].type).toBe("tool_use");
      expect(content[0].name).toBe("search");
      expect(content[0].input).toEqual({ q: "test" });
    });

    it("should convert tool results", () => {
      const input = {
        model: "gpt-4o",
        messages: [
          { role: "tool" as const, content: "result data", tool_call_id: "call_1" },
        ],
        max_tokens: 100,
      };

      const result = translateOpenAIToAnthropic(input, "drop");
      expect(result.messages[0].role).toBe("user");
      const content = result.messages[0].content as any[];
      expect(content[0].type).toBe("tool_result");
      expect(content[0].tool_use_id).toBe("call_1");
      expect(content[0].content).toBe("result data");
    });

    it("should convert image content", () => {
      const input = {
        model: "gpt-4o",
        messages: [
          {
            role: "user" as const,
            content: [
              { type: "text" as const, text: "What is this?" },
              { type: "image_url" as const, image_url: { url: "data:image/png;base64,abc123" } },
            ],
          },
        ],
        max_tokens: 100,
      };

      const result = translateOpenAIToAnthropic(input, "drop");
      const content = result.messages[0].content as any[];
      expect(content).toHaveLength(2);
      expect(content[0].type).toBe("text");
      expect(content[1].type).toBe("image");
      expect(content[1].source.type).toBe("base64");
      expect(content[1].source.media_type).toBe("image/png");
      expect(content[1].source.data).toBe("abc123");
    });

    it("should preserve stream and temperature", () => {
      const input = {
        model: "gpt-4o",
        messages: [{ role: "user" as const, content: "Hi" }],
        max_tokens: 100,
        stream: true,
        temperature: 0.7,
        top_p: 0.9,
      };

      const result = translateOpenAIToAnthropic(input, "drop");
      expect(result.stream).toBe(true);
      expect(result.temperature).toBe(0.7);
      expect(result.top_p).toBe(0.9);
    });
  });

  describe("translateAnthropicResponseToOpenAI", () => {
    it("should convert text response", () => {
      const anthropicResponse = {
        id: "msg_123",
        model: "claude-sonnet-4-20250514",
        content: [{ type: "text", text: "Hello!" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 5 },
      };

      const result = translateAnthropicResponseToOpenAI(anthropicResponse);
      expect(result.choices[0].message.content).toBe("Hello!");
      expect(result.choices[0].finish_reason).toBe("stop");
      expect(result.usage.prompt_tokens).toBe(10);
      expect(result.usage.completion_tokens).toBe(5);
    });

    it("should convert tool use response", () => {
      const anthropicResponse = {
        id: "msg_123",
        model: "claude-sonnet-4-20250514",
        content: [
          { type: "tool_use", id: "toolu_1", name: "search", input: { q: "test" } },
        ],
        stop_reason: "tool_use",
        usage: { input_tokens: 20, output_tokens: 15 },
      };

      const result = translateAnthropicResponseToOpenAI(anthropicResponse);
      expect(result.choices[0].message.tool_calls).toHaveLength(1);
      expect(result.choices[0].message.tool_calls[0].id).toBe("toolu_1");
      expect(result.choices[0].message.tool_calls[0].function.name).toBe("search");
      expect(result.choices[0].message.tool_calls[0].function.arguments).toBe('{"q":"test"}');
      expect(result.choices[0].finish_reason).toBe("tool_calls");
    });

    it("should map stop reasons correctly", () => {
      expect(translateAnthropicResponseToOpenAI({ content: [], stop_reason: "end_turn", usage: {} }).choices[0].finish_reason).toBe("stop");
      expect(translateAnthropicResponseToOpenAI({ content: [], stop_reason: "max_tokens", usage: {} }).choices[0].finish_reason).toBe("length");
      expect(translateAnthropicResponseToOpenAI({ content: [], stop_reason: "tool_use", usage: {} }).choices[0].finish_reason).toBe("tool_calls");
    });
  });
});
