import type { OpenAIChatRequest, AnthropicMessagesRequest, AnthropicMessage, AnthropicContentBlock, AnthropicTool } from "./types.js";
import type { TranslationFallback } from "@one-proxy/shared";
import { logger } from "../logger.js";

export function translateOpenAIToAnthropic(req: OpenAIChatRequest, fallback: TranslationFallback): AnthropicMessagesRequest {
  const systemMessages: string[] = [];
  const messages: AnthropicMessage[] = [];

  for (const msg of req.messages) {
    if (msg.role === "system") {
      if (typeof msg.content === "string") {
        systemMessages.push(msg.content);
      } else if (Array.isArray(msg.content)) {
        const text = msg.content.filter(p => p.type === "text").map(p => p.text || "").join("");
        if (text) systemMessages.push(text);
      }
      continue;
    }

    if (msg.role === "tool") {
      messages.push({
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: msg.tool_call_id || "",
          content: typeof msg.content === "string" ? msg.content : "",
        }],
      });
      continue;
    }

    if (msg.role === "assistant" && msg.tool_calls) {
      const blocks: AnthropicContentBlock[] = [];
      if (typeof msg.content === "string" && msg.content) {
        blocks.push({ type: "text", text: msg.content });
      }
      for (const tc of msg.tool_calls) {
        blocks.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments || "{}"),
        });
      }
      messages.push({ role: "assistant", content: blocks });
      continue;
    }

    const content = translateContent(msg.content, "o2a");
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content,
    });
  }

  const tools: AnthropicTool[] | undefined = req.tools?.map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters || { type: "object", properties: {} },
  }));

  const result: AnthropicMessagesRequest = {
    model: req.model,
    messages,
    max_tokens: req.max_tokens || 4096,
  };

  if (systemMessages.length > 0) {
    result.system = systemMessages.join("\n\n");
  }

  if (tools && tools.length > 0) {
    result.tools = tools;
  }

  if (req.temperature !== undefined) result.temperature = req.temperature;
  if (req.top_p !== undefined) result.top_p = req.top_p;
  if (req.stream !== undefined) result.stream = req.stream;

  for (const key of Object.keys(req)) {
    if (!["model", "messages", "tools", "max_tokens", "temperature", "top_p", "stream"].includes(key)) {
      if (fallback === "error") {
        logger.warn({ field: key }, "Unsupported field in OpenAI→Anthropic translation");
      } else {
        logger.warn({ field: key }, "Dropping unsupported field in OpenAI→Anthropic translation");
      }
    }
  }

  return result;
}

function translateContent(content: string | any[] | null, direction: "o2a" | "a2o"): string | AnthropicContentBlock[] {
  if (content === null || content === undefined) return "";
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  const blocks: AnthropicContentBlock[] = [];
  for (const part of content) {
    if (part.type === "text") {
      blocks.push({ type: "text", text: part.text || "" });
    } else if (part.type === "image_url" && part.image_url) {
      const url = part.image_url.url;
      if (url.startsWith("data:")) {
        const match = url.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          blocks.push({
            type: "image",
            source: { type: "base64", media_type: match[1], data: match[2] },
          });
        }
      }
    }
  }
  return blocks.length > 0 ? blocks : "";
}

export function translateAnthropicResponseToOpenAI(response: any): any {
  const content: any[] = [];
  const toolCalls: any[] = [];

  if (Array.isArray(response.content)) {
    for (const block of response.content) {
      if (block.type === "text") {
        content.push({ type: "text", text: block.text });
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          type: "function",
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input || {}),
          },
        });
      }
    }
  }

  const result: any = {
    id: response.id || "chatcmpl-proxy",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: response.model || "",
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: content.map(c => c.text).join("") || null,
      },
      finish_reason: mapStopReason(response.stop_reason),
    }],
    usage: {
      prompt_tokens: response.usage?.input_tokens || 0,
      completion_tokens: response.usage?.output_tokens || 0,
      total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
    },
  };

  if (toolCalls.length > 0) {
    result.choices[0].message.tool_calls = toolCalls;
  }

  return result;
}

function mapStopReason(reason: string | null): string {
  switch (reason) {
    case "end_turn": return "stop";
    case "max_tokens": return "length";
    case "tool_use": return "tool_calls";
    case "stop_sequence": return "stop";
    default: return "stop";
  }
}
